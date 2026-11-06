/**
 * A person's badge is drawn from their id, so it has to stay the same every time and differ
 * between people.
 */
import { barcodeBars, personalMarkCells, teachingSince } from '@/lib/personalMark'

const ID = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'

it('draws the same mark for the same person, and a different one for someone else', () => {
	expect(personalMarkCells(ID)).toEqual(personalMarkCells(ID))
	expect(personalMarkCells(ID)).not.toEqual(personalMarkCells(OTHER))
})

it('mirrors the mark, and lights enough of it to read as a shape', () => {
	const cells = personalMarkCells(ID)
	for (const row of cells) expect(row).toEqual([...row].reverse())
	const lit = cells.flat().filter(Boolean).length
	expect(lit).toBeGreaterThan(cells.flat().length / 4)
	expect(lit).toBeLessThan((cells.flat().length * 3) / 4)
})

it('fits the barcode inside its width, with gaps between the bars', () => {
	const bars = barcodeBars(ID, 280)
	expect(bars.length).toBeGreaterThan(10)
	const last = bars[bars.length - 1]!
	expect(last.x + last.width).toBeLessThanOrEqual(280)
	bars.slice(1).forEach((bar, i) => {
		expect(bar.x).toBeGreaterThan(bars[i]!.x + bars[i]!.width)
	})
	expect(barcodeBars(ID, 0)).toEqual([])
})

it('leaves out the date for an account without one', () => {
	expect(teachingSince(null)).toBeNull()
	expect(teachingSince(undefined)).toBeNull()
	expect(teachingSince('2026-10-30T10:00:00.000Z')).toContain('2026')
})
