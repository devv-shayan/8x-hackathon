import { useQuery } from '@tanstack/react-query'
import type { Profile } from '@app/contract'
import { api } from '@/lib/api'
import { getInitials } from '@/lib/utils'

// The signed-in person's own profile, through GET /api/app/v1/profile. `plan`
// is read-only: the RevenueCat webhook decides it on the server (AGENTS.md,
// non-negotiable 3), and the app only ever shows it.

export interface UserProfile {
	fullName: string
	email: string
	initials: string
	planType: Profile['plan']
	/** A short-lived signed URL. Show it; never store it. */
	avatarUrl: string | null
}

export function toUserProfile(profile: Profile): UserProfile {
	const email = profile.email ?? ''
	const fullName = profile.display_name?.trim() || email.split('@')[0] || 'You'
	return {
		fullName,
		email,
		initials: getInitials(fullName),
		planType: profile.plan,
		avatarUrl: profile.avatar_url
	}
}

export function useProfile() {
	return useQuery<UserProfile>({
		queryKey: ['profile'],
		queryFn: async ({ signal }) => toUserProfile((await api('getProfile', { signal })).profile)
	})
}
