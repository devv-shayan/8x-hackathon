#!/usr/bin/env python3
"""
log-session.py — write a markdown log of a Claude Code session into .claude-logs/

Two ways to run:
  1. As a SessionEnd hook (Claude Code pipes JSON on stdin with transcript_path + cwd).
     Configure in .claude/settings.json:
         { "hooks": { "SessionEnd": [{ "hooks": [
             { "type": "command",
               "command": "python3 \"$CLAUDE_PROJECT_DIR/.claude/log-session.py\"" } ] }] } }
  2. Backfill past sessions that have no log yet:
         python3 .claude/log-session.py --backfill
     (add --force to regenerate logs that already exist)

It reads the session transcript(s) Claude Code stores under
~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl and writes one
<date>_<time>_<id8>.md per session into <project>/.claude-logs/.

Author is stamped into each log's frontmatter. It is resolved, in order:
  1. the CLAUDE_LOG_AUTHOR environment variable, if set;
  2. the repo's `git config user.name` (spaces → dashes);
  3. "unknown".
So every engineer's logs are attributed automatically — nothing to edit per clone.

The template repository itself keeps no logs. When the root package.json is
still named "app-template" AND the origin remote is the template's own repo,
this script writes nothing, in hook mode and --backfill alike, and says so on
stderr. Any copy of the template has its own remote, so it logs from day one.
"""

import sys, os, re, json, glob, subprocess
from datetime import datetime, timezone

LONG_WORDS = 100  # a prompt longer than this counts as "long content"


def project_root():
    """Absolute path to the repo root (where .claude-logs/ belongs).

    Anchored to the project, never the live cwd: Claude Code may change its
    working directory mid-session, so we must not derive the log location from
    the payload cwd or os.getcwd(). Prefer $CLAUDE_PROJECT_DIR (set by Claude
    Code for hooks); fall back to this script's own location (.claude/ -> root).
    """
    env = os.environ.get("CLAUDE_PROJECT_DIR")
    if env and env.strip():
        return os.path.abspath(env.strip())
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ----------------------------- helpers -----------------------------

def parse_ts(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None

def to_local(dt):
    return dt.astimezone() if dt else None

def text_from_content(content):
    """Return concatenated text of a message, or None if it carries no real text
    (e.g. a pure tool_result / tool_use payload)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts, has_tool_result = [], False
        for it in content:
            if isinstance(it, dict):
                t = it.get("type")
                if t == "text":
                    parts.append(it.get("text", ""))
                elif t == "tool_result":
                    has_tool_result = True
        if parts:
            return "\n".join(parts)
        if has_tool_result:
            return None
    return None

def is_real_prompt(o):
    if o.get("isSidechain") or o.get("type") != "user":
        return False
    m = o.get("message")
    if not isinstance(m, dict):
        return False
    c = m.get("content")
    if isinstance(c, list):
        types = [it.get("type") for it in c if isinstance(it, dict)]
        if "tool_result" in types or "text" not in types:
            return False
    txt = text_from_content(c)
    return bool(txt and txt.strip())


def author_for(cwd):
    """Resolve the log author: env override → git user.name → 'unknown'."""
    env = os.environ.get("CLAUDE_LOG_AUTHOR")
    if env and env.strip():
        return env.strip().replace(" ", "-")
    try:
        out = subprocess.run(
            ["git", "config", "user.name"],
            cwd=cwd, capture_output=True, text=True, timeout=3,
        )
        name = (out.stdout or "").strip()
        if name:
            return name.replace(" ", "-")
    except Exception:
        pass
    return "unknown"


# ----------------------------- transcript -> exchanges -----------------------------

def read_exchanges(path):
    """Parse a transcript JSONL into a list of {prompt, pts, prts(raw), resp[], rts(raw)} exchanges."""
    exchanges, current = [], None
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                o = json.loads(line)
            except Exception:
                continue
            if o.get("isSidechain"):
                continue
            t = o.get("type")
            if t == "user" and is_real_prompt(o):
                txt = text_from_content(o["message"]["content"]).strip()
                current = {"prompt": txt, "prts": o.get("timestamp"),
                           "resp": [], "rts": None}
                exchanges.append(current)
            elif t == "assistant" and current is not None:
                m = o.get("message", {})
                txt = text_from_content(m.get("content") if isinstance(m, dict) else None)
                if txt and txt.strip():
                    current["resp"].append(txt.strip())
                    if current["rts"] is None:
                        current["rts"] = o.get("timestamp")
    return exchanges


def build_log(exchanges, session_id, cwd):
    """Return (filename, markdown_text) for a parsed session, or (None, None) if empty."""
    if not exchanges:
        return None, None

    id8 = session_id[:8]
    project = os.path.basename(cwd.rstrip("/")) or "unknown"
    author = author_for(cwd)

    def words(s):
        return len(s.split())

    prompts = [e["prompt"] for e in exchanges]
    responses = ["\n\n".join(e["resp"]) for e in exchanges]

    p_chars = [len(p) for p in prompts]
    p_words = [words(p) for p in prompts]
    r_chars = [len(r) for r in responses if r]

    total_p_chars, total_p_words = sum(p_chars), sum(p_words)
    total_r_chars = sum(r_chars)
    n = len(prompts)

    code = sum(1 for p in prompts if "```" in p)
    paths = sum(1 for p in prompts if re.search(r"\b[\w./-]+\.(tsx?|jsx?|py|json|md|css|s?css|html|sql|sh|ya?ml|toml)\b", p) or re.search(r"\b\w[\w-]*/[\w./-]+", p))
    urls = sum(1 for p in prompts if re.search(r"https?://", p))
    long_c = sum(1 for p in prompts if words(p) > LONG_WORDS)
    pasted = sum(1 for p in prompts if words(p) > LONG_WORDS and "\n" in p)

    first_pts, last_pts = exchanges[0]["prts"], exchanges[-1]["prts"]
    fdt, ldt = parse_ts(first_pts), parse_ts(last_pts)
    dur = round((ldt - fdt).total_seconds() / 60.0, 1) if (fdt and ldt) else 0.0
    last_type = "assistant" if exchanges[-1]["resp"] else "user"

    # filename / date come from the session's last local activity
    end_local = to_local(parse_ts(exchanges[-1]["rts"] or last_pts)) or datetime.now().astimezone()
    fname = f"{end_local.strftime('%Y-%m-%d_%H-%M-%S')}_{id8}.md"
    date_str = end_local.strftime("%Y-%m-%d")

    def ratio(a, b):
        return round(a / b, 2) if b else 0.0

    fm = [
        ("session_id", id8),
        ("date", date_str),
        ("author", author),
        ("project", project),
        ("session_status", "complete"),
        ("last_entry_type", last_type),
        ("total_exchanges", n),
        ("generated_at", datetime.now().isoformat()),
        ("first_prompt_time", first_pts),
        ("last_prompt_time", last_pts),
        ("session_duration_minutes", dur),
        ("total_prompt_chars", total_p_chars),
        ("total_prompt_words", total_p_words),
        ("avg_prompt_length_chars", round(total_p_chars / n, 1)),
        ("avg_prompt_length_words", round(total_p_words / n, 1)),
        ("longest_prompt_words", max(p_words) if p_words else 0),
        ("shortest_prompt_words", min(p_words) if p_words else 0),
        ("total_response_chars", total_r_chars),
        ("avg_response_length_chars", round(total_r_chars / n, 1)),
        ("response_to_prompt_ratio", ratio(total_r_chars, total_p_chars)),
        ("prompts_with_code_blocks", code),
        ("prompts_with_file_paths", paths),
        ("prompts_with_urls", urls),
        ("prompts_with_long_content", long_c),
        ("likely_pasted_count", pasted),
    ]

    out = ["---"]
    out += [f"{k}: {v}" for k, v in fm]
    out += ["---", "", f"# Claude Session Log - {date_str}", "",
            f"Session: `{id8}` | Project: `{project}` | Author: `{author}`", "", "---", ""]

    path_re = re.compile(r"\b\w[\w-]*/[\w./-]+")
    url_re = re.compile(r"https?://")
    for i, e in enumerate(exchanges, 1):
        p = e["prompt"]
        pdt = to_local(parse_ts(e["prts"]))
        has_code = "```" in p
        has_paths = bool(path_re.search(p))
        has_urls = bool(url_re.search(p))
        is_pasted = words(p) > LONG_WORDS and "\n" in p
        out += ["",
                f"[CLAUDE_LOG_ENTRY type=PROMPT num={i} session={id8}]",
                f"timestamp: {e['prts']}",
                f"time: {pdt.strftime('%Y-%m-%d %H:%M') if pdt else ''}",
                f"chars: {len(p)}",
                f"words: {words(p)}",
                f"has_code_block: {has_code}",
                f"has_file_paths: {has_paths}",
                f"has_urls: {has_urls}",
                f"likely_pasted: {is_pasted}",
                "", p, ""]
        r = "\n\n".join(e["resp"])
        if r:
            rdt = to_local(parse_ts(e["rts"]))
            out += ["",
                    f"[CLAUDE_LOG_ENTRY type=RESPONSE num={i} session={id8}]",
                    f"timestamp: {e['rts']}",
                    f"time: {rdt.strftime('%Y-%m-%d %H:%M') if rdt else ''}",
                    f"chars: {len(r)}",
                    "", r, ""]

    return fname, "\n".join(out) + "\n"


def write_session(transcript_path, cwd, session_id=None, force=False):
    session_id = session_id or os.path.splitext(os.path.basename(transcript_path))[0]
    exchanges = read_exchanges(transcript_path)
    fname, text = build_log(exchanges, session_id, cwd)
    if not fname:
        return None
    outdir = os.path.join(project_root(), ".claude-logs")
    os.makedirs(outdir, exist_ok=True)
    id8 = session_id[:8]
    existing = glob.glob(os.path.join(outdir, f"*_{id8}.md"))
    if existing and not force:
        return None  # already logged (backfill skips)
    # Write to a temp file and swap it in, so a failed write cannot leave a
    # 0-byte log behind. Only drop the session's older log once the new one is
    # safely on disk -- deleting first meant a failed write lost both.
    path = os.path.join(outdir, fname)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    os.replace(tmp, path)
    for old in existing:
        if os.path.abspath(old) != os.path.abspath(path):
            try:
                os.remove(old)
            except OSError:
                pass
    return path


# ----------------------------- entry points -----------------------------

def encoded_project_dir(cwd):
    # Claude Code encodes the project path by replacing separators with "-".
    # On Windows the cwd is C:\Users\me\Repo, so the backslashes and the drive
    # colon have to go too -- otherwise the computed folder never exists, the
    # glob matches nothing, and --backfill reports success having done nothing.
    enc = cwd.replace("\\", "-").replace("/", "-").replace(":", "-").replace(".", "-")
    return os.path.join(os.path.expanduser("~/.claude/projects"), enc)

def backfill(cwd, force=False):
    proj = encoded_project_dir(cwd)
    made = []
    for tp in sorted(glob.glob(os.path.join(proj, "*.jsonl")), key=os.path.getmtime):
        try:
            p = write_session(tp, cwd, force=force)
            if p:
                made.append(p)
        except Exception as e:
            print(f"  skip {os.path.basename(tp)}: {e}", file=sys.stderr)
    return made

TEMPLATE_PACKAGE_NAME = "app-template"


TEMPLATE_REMOTE = re.compile(r"github\.com[:/]8xsocial/template-monorepo(\.git)?/?$", re.IGNORECASE)


def is_template_repo():
    """True when this checkout is the template itself, not a play cloned from it.

    Both have to hold: the root package.json still has the template's name, and
    the `origin` remote is the template's own repository. A copy made with "Use
    this template" has its own remote, so it logs from its first session even
    before anyone renames the package. Anything unreadable counts as a play:
    logging stays on unless the template is positively identified.
    """
    try:
        with open(os.path.join(project_root(), "package.json"), encoding="utf-8") as fh:
            if json.load(fh).get("name") != TEMPLATE_PACKAGE_NAME:
                return False
        remote = subprocess.run(
            ["git", "-C", project_root(), "remote", "get-url", "origin"],
            capture_output=True, text=True, timeout=5,
        ).stdout.strip()
        return bool(TEMPLATE_REMOTE.search(remote))
    except Exception:
        return False


def main():
    if is_template_repo():
        print(
            f"log-session: not writing a session log: this is the template repository "
            f"itself (package \"{TEMPLATE_PACKAGE_NAME}\", origin is the template's repo).",
            file=sys.stderr,
        )
        sys.exit(0)

    force = "--force" in sys.argv
    if "--backfill" in sys.argv:
        cwd = project_root()
        made = backfill(cwd, force=force)
        print(f"Backfill complete: wrote {len(made)} log(s) to {os.path.join(cwd, '.claude-logs')}")
        for m in made:
            print("  +", os.path.basename(m))
        return

    # hook mode: Claude Code pipes JSON on stdin
    raw = sys.stdin.read() if not sys.stdin.isatty() else ""
    data = {}
    if raw.strip():
        try:
            data = json.loads(raw)
        except Exception:
            pass
    tp = data.get("transcript_path")
    cwd = data.get("cwd") or os.getcwd()
    sid = data.get("session_id")
    if not tp or not os.path.exists(tp):
        sys.exit(0)  # nothing to log, exit quietly
    try:
        write_session(tp, cwd, session_id=sid, force=True)
    except Exception as e:
        print(f"log-session: {e}", file=sys.stderr)
    sys.exit(0)

if __name__ == "__main__":
    main()
