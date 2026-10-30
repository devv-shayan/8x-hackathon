#!/usr/bin/env python3
"""Extract clean conversation logs from Cursor agent sessions into .claude-logs/."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


def get_git_author(cwd: Path) -> str:
    if author := os.environ.get("CLAUDE_AUTHOR"):
        return author
    try:
        result = subprocess.run(
            ["git", "config", "user.name"],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=cwd,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        pass
    return "unknown"


def get_github_user() -> str:
    if login := os.environ.get("GITHUB_USER"):
        return login
    try:
        result = subprocess.run(
            ["gh", "api", "user", "--jq", ".login"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        pass
    return "unknown"


def get_git_email(cwd: Path) -> str:
    try:
        result = subprocess.run(
            ["git", "config", "user.email"],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=cwd,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        pass
    return "unknown"


def read_hook_payload() -> Dict[str, Any]:
    # Read bytes so we can strip a UTF-8 BOM that Windows PowerShell 5.1
    # sometimes prefixes onto hook stdin (Cursor forum: hooks BOM issue).
    raw_bytes = sys.stdin.buffer.read()
    if raw_bytes.startswith(b"\xef\xbb\xbf"):
        raw_bytes = raw_bytes[3:]
    raw = raw_bytes.decode("utf-8", errors="replace").strip()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def normalize_workspace_path(raw: str) -> Path:
    """Turn Cursor's workspace_roots entries into a real local Path.

    On Windows, Cursor often sends Unix-looking roots like `/d:/learning-app`.
    `Path('/d:/learning-app')` becomes `\\d:\\learning-app`, which is not a
    valid Win32 path — mkdir fails with WinError 123 and logging dies silently
    inside the fail-open handler.
    """
    text = (raw or "").strip().strip('"')
    if not text:
        return Path.cwd()
    unix_drive = re.match(r"^/([A-Za-z]):(/.*)?$", text.replace("\\", "/"))
    if unix_drive:
        drive = unix_drive.group(1)
        rest = unix_drive.group(2) or "/"
        return Path(f"{drive}:{rest}")
    return Path(text)


def workspace_root(payload: Dict[str, Any]) -> Path:
    candidates: List[Path] = []
    for root in payload.get("workspace_roots") or []:
        if isinstance(root, str) and root.strip():
            candidates.append(normalize_workspace_path(root))
    env_dir = os.environ.get("CURSOR_PROJECT_DIR")
    if env_dir:
        candidates.append(normalize_workspace_path(env_dir))
    candidates.append(Path.cwd())

    for path in candidates:
        try:
            resolved = path.resolve()
        except OSError:
            continue
        if resolved.is_dir():
            return resolved
    return Path.cwd()


def project_slug(cwd: Path) -> str:
    # Cursor stores project state under ~/.cursor/projects/<slug>/
    # e.g. d:\learning-app -> d-learning-app
    resolved = str(cwd.resolve())
    slug = resolved.replace(":\\", "-").replace("\\", "-").replace("/", "-")
    slug = re.sub(r"-+", "-", slug).strip("-").lower()
    return slug


def find_transcript(payload: Dict[str, Any], cwd: Path) -> Optional[Path]:
    transcript = payload.get("transcript_path")
    if transcript:
        path = Path(transcript)
        if path.is_file():
            return path

    conversation_id = payload.get("conversation_id") or payload.get("session_id")
    if not conversation_id:
        return None

    projects_root = Path.home() / ".cursor" / "projects"
    candidates: List[Path] = []

    slug = project_slug(cwd)
    preferred = projects_root / slug / "agent-transcripts"
    search_roots = [preferred] if preferred.exists() else []
    if projects_root.exists():
        search_roots.extend(sorted(projects_root.glob("*/agent-transcripts")))

    seen = set()
    for root in search_roots:
        key = str(root.resolve()) if root.exists() else None
        if not key or key in seen:
            continue
        seen.add(key)
        direct = root / conversation_id / f"{conversation_id}.jsonl"
        if direct.is_file():
            return direct
        candidates.extend(root.glob(f"**/{conversation_id}.jsonl"))
        candidates.extend(root.glob(f"**/{conversation_id}/*.jsonl"))

    if candidates:
        return max(candidates, key=lambda p: p.stat().st_mtime)
    return None


def strip_user_wrappers(text: str) -> str:
    """Prefer the inner <user_query> body when Cursor wraps the prompt."""
    match = re.search(r"<user_query>\s*(.*?)\s*</user_query>", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    text = re.sub(r"<timestamp>.*?</timestamp>\s*", "", text, flags=re.DOTALL)
    text = re.sub(r"<uploaded_documents>.*?</uploaded_documents>\s*", "", text, flags=re.DOTALL)
    return text.strip()


def content_to_text(content: Any) -> Optional[str]:
    if isinstance(content, str):
        return content.strip() or None
    if not isinstance(content, list):
        return None
    texts: List[str] = []
    for block in content:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "text":
            text = (block.get("text") or "").strip()
            if text:
                texts.append(text)
        elif block.get("type") in {"tool_use", "tool_result", "thinking"}:
            continue
    return "\n\n".join(texts) if texts else None


def extract_clean_log(jsonl_path: Path) -> List[Tuple[str, str, str]]:
    entries: List[Tuple[str, str, str]] = []
    try:
        lines = jsonl_path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return []

    for line in lines:
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue

        if entry.get("type") == "turn_ended":
            continue

        role = entry.get("role")
        timestamp = entry.get("timestamp") or ""
        message = entry.get("message") or {}
        content = message.get("content", entry.get("content", ""))

        if role == "user":
            text = content_to_text(content)
            if not text:
                continue
            cleaned = strip_user_wrappers(text)
            if cleaned:
                entries.append((timestamp, "user", cleaned))
        elif role == "assistant":
            text = content_to_text(content)
            if text:
                entries.append((timestamp, "assistant", text))

    return entries


def format_timestamp(iso_timestamp: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_timestamp.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M")
    except (ValueError, AttributeError):
        return ""


def dedupe_entries(entries: List[Tuple[str, str, str]]) -> List[Tuple[str, str, str]]:
    if not entries:
        return []

    result: List[Tuple[str, str, str]] = []
    pending_assistant: Optional[Tuple[str, str, str]] = None

    for timestamp, role, content in entries:
        if role == "user":
            if pending_assistant:
                result.append(pending_assistant)
                pending_assistant = None
            result.append((timestamp, role, content))
        elif role == "assistant":
            pending_assistant = (timestamp, role, content)

    if pending_assistant:
        result.append(pending_assistant)

    return result


def detect_paste_indicators(content: str) -> Dict[str, bool]:
    indicators = {
        "has_code_block": "```" in content,
        "has_file_paths": bool(
            re.search(r"[\w\-/]+\.(ts|js|py|tsx|jsx|json|md|txt|yml|yaml):\d+", content)
        )
        or bool(re.search(r"(?:^|[\s\(])/[\w\-/]+\.[\w]+", content, re.MULTILINE)),
        "has_urls": bool(re.search(r"https?://", content)),
        "is_long": len(content) > 500,
        "has_stack_trace": bool(re.search(r"at \w+.*:\d+:\d+", content))
        or bool(re.search(r'File ".*", line \d+', content)),
        "has_structured_data": bool(re.search(r"^[\s]*[{\[]", content, re.MULTILINE))
        and ("{" in content and "}" in content),
    }
    indicator_count = sum(indicators.values())
    indicators["likely_pasted"] = indicator_count >= 2 or indicators["is_long"]
    return indicators


def parse_iso_timestamp(timestamp: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def calculate_session_stats(entries: List[Tuple[str, str, str]]) -> Dict[str, Any]:
    if not entries:
        return {}

    prompts = [(ts, content) for ts, role, content in entries if role == "user"]
    responses = [(ts, content) for ts, role, content in entries if role == "assistant"]
    if not prompts:
        return {}

    stats: Dict[str, Any] = {}
    first_prompt_dt = parse_iso_timestamp(prompts[0][0])
    last_prompt_dt = parse_iso_timestamp(prompts[-1][0])
    stats["first_prompt_time"] = prompts[0][0]
    stats["last_prompt_time"] = prompts[-1][0]

    if first_prompt_dt and last_prompt_dt:
        duration = (last_prompt_dt - first_prompt_dt).total_seconds() / 60
        stats["session_duration_minutes"] = round(duration, 1)
        if len(prompts) > 1:
            stats["avg_time_between_prompts_minutes"] = round(duration / (len(prompts) - 1), 1)

    prompt_chars = [len(content) for _, content in prompts]
    prompt_words = [len(content.split()) for _, content in prompts]
    stats["total_prompt_chars"] = sum(prompt_chars)
    stats["total_prompt_words"] = sum(prompt_words)
    stats["avg_prompt_length_chars"] = round(sum(prompt_chars) / len(prompts), 1)
    stats["avg_prompt_length_words"] = round(sum(prompt_words) / len(prompts), 1)
    stats["longest_prompt_words"] = max(prompt_words)
    stats["shortest_prompt_words"] = min(prompt_words)

    if responses:
        response_chars = [len(content) for _, content in responses]
        stats["total_response_chars"] = sum(response_chars)
        stats["avg_response_length_chars"] = round(sum(response_chars) / len(responses), 1)
        if stats["total_prompt_chars"] > 0:
            stats["response_to_prompt_ratio"] = round(
                stats["total_response_chars"] / stats["total_prompt_chars"], 2
            )

    paste_data = [detect_paste_indicators(content) for _, content in prompts]
    stats["prompts_with_code_blocks"] = sum(1 for p in paste_data if p["has_code_block"])
    stats["prompts_with_file_paths"] = sum(1 for p in paste_data if p["has_file_paths"])
    stats["prompts_with_urls"] = sum(1 for p in paste_data if p["has_urls"])
    stats["prompts_with_long_content"] = sum(1 for p in paste_data if p["is_long"])
    stats["likely_pasted_count"] = sum(1 for p in paste_data if p["likely_pasted"])
    return stats


def write_log(
    cwd: Path,
    session_id: str,
    entries: List[Tuple[str, str, str]],
) -> Optional[Path]:
    if not entries:
        return None

    session_stats = calculate_session_stats(entries)
    output_dir = cwd / ".claude-logs"
    output_dir.mkdir(parents=True, exist_ok=True)

    existing_files = list(output_dir.glob(f"*_{session_id}.md"))
    date = datetime.now().strftime("%Y-%m-%d")
    if existing_files:
        output_path = existing_files[0]
    else:
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        output_path = output_dir / f"{timestamp}_{session_id}.md"

    last_entry_type = entries[-1][1]
    session_status = "complete" if last_entry_type == "assistant" else "awaiting_response"
    author = get_git_author(cwd)
    github_user = get_github_user()
    git_email = get_git_email(cwd)

    lines = [
        "---",
        f"session_id: {session_id}",
        f"date: {date}",
        f"author: {author}",
        f"github_user: {github_user}",
        f"git_email: {git_email}",
        f"project: {cwd.name}",
        f"agent: cursor",
        f"session_status: {session_status}",
        f"last_entry_type: {last_entry_type}",
        f"total_exchanges: {len([e for e in entries if e[1] == 'user'])}",
        f"generated_at: {datetime.now(timezone.utc).isoformat()}",
    ]
    for key, value in session_stats.items():
        lines.append(f"{key}: {value}")
    lines.extend(
        [
            "---\n",
            f"# Claude Session Log - {date}\n",
            f"Session: `{session_id}` | Project: `{cwd.name}` | Author: `{author}` | GitHub: `{github_user}`\n",
            "---\n",
        ]
    )

    prompts_data = []
    for timestamp, role, content in entries:
        if role == "user":
            paste_indicators = detect_paste_indicators(content)
            prompts_data.append(
                {
                    "timestamp": timestamp,
                    "content": content,
                    "chars": len(content),
                    "words": len(content.split()),
                    "paste_indicators": paste_indicators,
                }
            )

    exchange_num = 0
    prompt_index = 0
    for timestamp, role, content in entries:
        time_str = format_timestamp(timestamp)
        if role == "user":
            exchange_num += 1
            prompt_data = prompts_data[prompt_index]
            indicators = prompt_data["paste_indicators"]
            lines.append(f"\n[CLAUDE_LOG_ENTRY type=PROMPT num={exchange_num} session={session_id}]")
            lines.append(f"timestamp: {timestamp}")
            lines.append(f"time: {time_str}")
            lines.append(f"chars: {prompt_data['chars']}")
            lines.append(f"words: {prompt_data['words']}")
            lines.append(f"has_code_block: {indicators['has_code_block']}")
            lines.append(f"has_file_paths: {indicators['has_file_paths']}")
            lines.append(f"has_urls: {indicators['has_urls']}")
            lines.append(f"likely_pasted: {indicators['likely_pasted']}")
            lines.append(f"\n{content}\n")
            prompt_index += 1
        else:
            lines.append(f"\n[CLAUDE_LOG_ENTRY type=RESPONSE num={exchange_num} session={session_id}]")
            lines.append(f"timestamp: {timestamp}")
            lines.append(f"time: {time_str}")
            lines.append(f"chars: {len(content)}")
            lines.append(f"\n{content}\n")

    output_path.write_text("\n".join(lines), encoding="utf-8")
    return output_path


def fallback_from_hook_payload(payload: Dict[str, Any]) -> List[Tuple[str, str, str]]:
    """If the transcript isn't ready yet, still capture the just-submitted prompt."""
    entries: List[Tuple[str, str, str]] = []
    now = datetime.now(timezone.utc).isoformat()
    prompt = (payload.get("prompt") or "").strip()
    if prompt:
        entries.append((now, "user", strip_user_wrappers(prompt)))
    text = (payload.get("text") or "").strip()
    if text:
        entries.append((now, "assistant", text))
    return entries


def emit_before_submit_continue(payload: Dict[str, Any]) -> None:
    if payload.get("hook_event_name") == "beforeSubmitPrompt":
        print(json.dumps({"continue": True}))


def main(payload: Optional[Dict[str, Any]] = None) -> None:
    payload = payload if payload is not None else read_hook_payload()
    cwd = workspace_root(payload)
    session_id = payload.get("conversation_id") or payload.get("session_id") or "unknown"

    transcript = find_transcript(payload, cwd)
    entries: List[Tuple[str, str, str]] = []
    if transcript and transcript.is_file():
        session_id = transcript.stem or session_id
        entries = dedupe_entries(extract_clean_log(transcript))

    if not entries:
        entries = dedupe_entries(fallback_from_hook_payload(payload))

    if not entries:
        # Always succeed open — never block the agent loop.
        emit_before_submit_continue(payload)
        return

    write_log(cwd, session_id, entries)
    emit_before_submit_continue(payload)


if __name__ == "__main__":
    payload: Dict[str, Any] = {}
    try:
        payload = read_hook_payload()
        main(payload)
    except Exception as error:
        # Fail open: logging must never break the agent. Record the reason
        # outside the tracked .claude-logs/ tree so a silent WinError isn't
        # invisible again and never gets committed.
        try:
            import tempfile

            err_path = Path(tempfile.gettempdir()) / "cursor-extract-session-log-error.txt"
            err_path.write_text(
                f"{datetime.now(timezone.utc).isoformat()} {type(error).__name__}: {error}\n",
                encoding="utf-8",
            )
        except Exception:
            pass
        emit_before_submit_continue(payload)
        sys.exit(0)
