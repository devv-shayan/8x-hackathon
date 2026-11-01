import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const DUE_WARM_UPS_KEY = ['warm-ups', 'due'] as const

// One question plus a judgment. Longer than the default: Gemini can be slow.
const WARM_UP_TIMEOUT_MS = 60_000

/** Open gaps that are due, oldest first. */
export function useDueWarmUps() {
	return useQuery({
		queryKey: DUE_WARM_UPS_KEY,
		queryFn: ({ signal }) => api('listDueWarmUps', { signal }).then((response) => response.warm_ups)
	})
}

/** Saves a question for a gap, or returns the one already waiting. */
export function useStartWarmUp() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (gapId: string) =>
			api('startWarmUp', {
				body: { gap_id: gapId },
				timeoutMs: WARM_UP_TIMEOUT_MS
			}).then((response) => response.warm_up),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: DUE_WARM_UPS_KEY })
		}
	})
}

/** Judges the person's own words and moves the gap. */
export function useAnswerWarmUp() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ id, answer }: { id: string; answer: string }) =>
			api('answerWarmUp', {
				params: { id },
				body: { answer },
				timeoutMs: WARM_UP_TIMEOUT_MS
			}),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: DUE_WARM_UPS_KEY })
		}
	})
}
