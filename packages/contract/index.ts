// @app/contract: the Zod schemas for every /api/app/v1 route, shared by the web
// (which validates input and output with them) and the app (which parses every
// response with them). One definition of each shape (docs/rules/mobile-data.md).
export * from './src/v1/common'
export * from './src/v1/config'
export * from './src/v1/profile'
export * from './src/v1/items'
export * from './src/v1/tasks'
export * from './src/v1/activity'
export * from './src/v1/notifications'
export * from './src/v1/account'
export * from './src/v1/uploads'
export * from './src/v1/videos'
export * from './src/v1/classes'
export * from './src/v1/endpoints'
