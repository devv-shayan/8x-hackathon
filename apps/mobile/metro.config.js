// Monorepo-aware Metro config.
//
// In an npm-workspaces monorepo, most dependencies are hoisted to the repo-root
// node_modules and shared packages live in packages/*. Metro only watches the
// project folder by default, so we widen it to the repo root and tell the
// resolver to look in both node_modules trees. getSentryExpoConfig() gives us
// the standard Expo config with Sentry's source-map plumbing already applied.
const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getSentryExpoConfig(projectRoot)

// Watch the whole monorepo (picks up packages/* and the hoisted root deps).
config.watchFolders = [monorepoRoot]

// Resolve from the app first, then fall back to the hoisted root node_modules.
config.resolver.nodeModulesPaths = [
	path.resolve(projectRoot, 'node_modules'),
	path.resolve(monorepoRoot, 'node_modules')
]

module.exports = config
