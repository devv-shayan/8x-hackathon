import { getInitials, clamp, isValidEmail, formatRelativeDate } from '@/lib/utils'

describe('getInitials', () => {
	it('returns two-letter initials from full name', () => {
		expect(getInitials('Alex Rivera')).toBe('AR')
	})
	it('returns first two chars for single name', () => {
		expect(getInitials('Alex')).toBe('AL')
	})
	it('uses first and last word when name has 3+ words', () => {
		expect(getInitials('Mary Jane Watson')).toBe('MW')
	})
	it('returns ? for empty string', () => {
		expect(getInitials('')).toBe('?')
	})
})

describe('clamp', () => {
	it('clamps below min to min', () => expect(clamp(-5, 0, 100)).toBe(0))
	it('clamps above max to max', () => expect(clamp(200, 0, 100)).toBe(100))
	it('leaves value within range untouched', () => expect(clamp(50, 0, 100)).toBe(50))
})

describe('isValidEmail', () => {
	it('accepts valid emails', () => {
		expect(isValidEmail('user@example.com')).toBe(true)
		expect(isValidEmail('a+b@co.io')).toBe(true)
	})
	it('rejects invalid emails', () => {
		expect(isValidEmail('notanemail')).toBe(false)
		expect(isValidEmail('@nodomain')).toBe(false)
		expect(isValidEmail('missing@tld')).toBe(false)
	})
})

describe('formatRelativeDate', () => {
	it('returns Today for today', () => {
		expect(formatRelativeDate(new Date())).toBe('Today')
	})
	it('returns Yesterday for yesterday', () => {
		const yesterday = new Date()
		yesterday.setDate(yesterday.getDate() - 1)
		expect(formatRelativeDate(yesterday)).toBe('Yesterday')
	})
	it('returns a locale string for older dates', () => {
		const old = new Date('2020-01-15')
		const result = formatRelativeDate(old)
		expect(result).not.toBe('Today')
		expect(result).not.toBe('Yesterday')
		expect(result.length).toBeGreaterThan(0)
	})
})
