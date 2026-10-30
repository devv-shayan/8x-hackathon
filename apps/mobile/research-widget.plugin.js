// The native half of the 8xResearch interview widget (components/ResearchWidget.tsx).
//
// The widget runs voice interviews, so it needs the microphone, and an app that never
// shows it must not ask for one (Apple 5.1.1, Play's permissions policy). So this adds
// the microphone only when EXPO_PUBLIC_RESEARCH_PRODUCT_KEY is set for the build, the same
// value that switches the widget on in the app:
//
//   Android  RECORD_AUDIO and MODIFY_AUDIO_SETTINGS, and RECORD_AUDIO off the blocked list
//   iOS      NSMicrophoneUsageDescription set to `microphonePermission`
//
// Unset, it changes nothing. Setting it changes the app config, so the fingerprint runtime
// version changes with it: an update published with the key set reaches only builds that
// were made with it, never a binary without the microphone.
//
// List it BEFORE expo-image-picker in app.json. That plugin also writes the microphone
// string, and of two plugins that edit Info.plist the one listed first applies last, so
// this string wins. If the app also films video, say both uses in this one string.
const { withInfoPlist } = require('expo/config-plugins')

// Mirrors RESEARCH_PRODUCT_KEY in lib/env.ts; __tests__/researchWidget.test.tsx checks they agree.
const PRODUCT_KEY = /^[0-9a-f]{18}$/
const MICROPHONE = ['android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS']

/** True when the build has a product key the app will accept. */
function researchWidgetEnabled(key = process.env.EXPO_PUBLIC_RESEARCH_PRODUCT_KEY) {
	return PRODUCT_KEY.test(key?.trim() ?? '')
}

function withResearchWidget(config, { microphonePermission } = {}) {
	if (!researchWidgetEnabled()) return config
	if (typeof microphonePermission !== 'string' || microphonePermission.trim() === '') {
		throw new Error(
			'research-widget.plugin.js: give it a microphonePermission string that says why the app uses the microphone (Apple 5.1.1).'
		)
	}
	const android = config.android ?? {}
	config.android = {
		...android,
		permissions: [...new Set([...(android.permissions ?? []), ...MICROPHONE])],
		blockedPermissions: (android.blockedPermissions ?? []).filter(
			(permission) => !MICROPHONE.includes(permission)
		)
	}
	// Written into the config too, so `expo config` and the fingerprint show it.
	config.ios = {
		...config.ios,
		infoPlist: { ...config.ios?.infoPlist, NSMicrophoneUsageDescription: microphonePermission }
	}
	return withInfoPlist(config, (plist) => {
		plist.modResults.NSMicrophoneUsageDescription = microphonePermission
		return plist
	})
}

module.exports = withResearchWidget
module.exports.researchWidgetEnabled = researchWidgetEnabled
module.exports.PRODUCT_KEY = PRODUCT_KEY
