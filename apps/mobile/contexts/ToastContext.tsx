import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
	FadeInUp,
	FadeOutDown,
	LinearTransition,
	ReduceMotion
} from 'react-native-reanimated'
import { useTabBarClearance } from '@/components/TabBar'
import { Text } from '@/components/ui/Text'
import { useColors } from '@/contexts/ThemeContext'
import { haptic } from '@/lib/haptics'
import { Durations, Easings } from '@/lib/motion'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastOptions {
	/** An action on the toast, typically Undo. */
	action?: { label: string; onPress: () => void }
	/** ms on screen. Defaults to 3.2 s, or 6 s when there is an action to reach for. */
	duration?: number
}

interface Toast extends ToastOptions {
	id: number
	message: string
	type: ToastType
}

interface ToastContextValue {
	showToast: (message: string, type?: ToastType, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function useToast() {
	return useContext(ToastContext)
}

let nextId = 0

/**
 * Transient confirmation above the tab bar, on the hero surface so it reads the
 * same over any screen in either scheme. One Undo-style action at most. A tap
 * anywhere on it dismisses it.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([])

	const dismiss = useCallback((id: number) => {
		setToasts((prev) => prev.filter((t) => t.id !== id))
	}, [])

	const showToast = useCallback(
		(message: string, type: ToastType = 'info', options: ToastOptions = {}) => {
			const id = ++nextId
			if (type === 'error') haptic.error()
			setToasts((prev) => [...prev.slice(-2), { id, message, type, ...options }])
		},
		[]
	)

	const value = useMemo(() => ({ showToast }), [showToast])

	return (
		<ToastContext.Provider value={value}>
			{children}
			<ToastStack toasts={toasts} onDismiss={dismiss} />
		</ToastContext.Provider>
	)
}

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
	const bottom = useTabBarClearance() - 8
	if (toasts.length === 0) return null
	return (
		<View pointerEvents="box-none" style={[s.stack, { bottom }]}>
			{toasts.map((t) => (
				<ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
			))}
		</View>
	)
}

const entering = FadeInUp.duration(Durations.modalIn)
	.easing(Easings.out)
	.reduceMotion(ReduceMotion.System)
const exiting = FadeOutDown.duration(Durations.modalOut)
	.easing(Easings.in)
	.reduceMotion(ReduceMotion.System)
const layout = LinearTransition.duration(Durations.fast).reduceMotion(ReduceMotion.System)

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
	const c = useColors()
	const dismissRef = useRef(onDismiss)
	useEffect(() => {
		dismissRef.current = onDismiss
	})

	useEffect(() => {
		const ms = toast.duration ?? (toast.action ? 6000 : 3200)
		const timer = setTimeout(() => dismissRef.current(), ms)
		return () => clearTimeout(timer)
	}, [toast.duration, toast.action])

	const dot = { success: c.success, error: c.error, info: c.heroBrandInk }[toast.type]

	return (
		<Animated.View entering={entering} exiting={exiting} layout={layout}>
			<Pressable
				onPress={onDismiss}
				accessibilityRole="alert"
				accessibilityLiveRegion="polite"
				style={[s.toast, { backgroundColor: c.hero, borderColor: c.heroBorder }]}
			>
				<View style={[s.dot, { backgroundColor: dot }]} />
				<Text variant="bodySm" numberOfLines={2} style={[s.message, { color: c.heroText }]}>
					{toast.message}
				</Text>
				{toast.action ? (
					<Pressable
						hitSlop={12}
						accessibilityRole="button"
						onPress={() => {
							haptic.select()
							toast.action?.onPress()
							onDismiss()
						}}
					>
						<Text variant="label" style={{ color: c.heroBrandInk }}>
							{toast.action.label}
						</Text>
					</Pressable>
				) : null}
			</Pressable>
		</Animated.View>
	)
}

const s = StyleSheet.create({
	stack: { position: 'absolute', left: 16, right: 16, gap: 8 },
	toast: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		minHeight: 52,
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderRadius: 18,
		borderWidth: StyleSheet.hairlineWidth
	},
	dot: { width: 8, height: 8, borderRadius: 4 },
	message: { flex: 1 }
})
