/**
 * A heading set line by line, so a parallel pair ("Quick to open. / Quicker
 * to put down.") breaks at its clauses, never mid-clause. A line still wraps
 * on its own if a narrow screen needs it to.
 */
export function Lines({ lines }: { lines: readonly string[] }) {
	return (
		<>
			{lines.map((line) => (
				<span key={line} className="block text-balance">
					{line}
				</span>
			))}
		</>
	)
}
