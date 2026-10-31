import type { z } from 'zod'
import { deleteAccountResponse } from './account'
import { listActivityQuery, listActivityResponse } from './activity'
import { appConfigSchema } from './config'
import {
	createItemBody,
	itemParams,
	itemResponse,
	listItemsQuery,
	listItemsResponse
} from './items'
import { listNotificationsQuery, listNotificationsResponse } from './notifications'
import { profileResponse, updateProfileBody } from './profile'
import { createTaskBody, listTasksQuery, listTasksResponse, taskResponse } from './tasks'
import { createUploadBody, createUploadResponse } from './uploads'
import { readVideoBody, readVideoResponse } from './videos'
import {
	answerTurnBody,
	classParams,
	classResponse,
	classTurnParams,
	endClassBody,
	openClassQuery,
	openClassResponse,
	startClassBody
} from './classes'

// Every /api/app/v1 route, once: its method, path, who may call it, and the
// schemas for what goes in and what comes back. The web builds each route from
// its entry (src/server/api/app-route.ts); the app's API client
// (apps/mobile/lib/api.ts) calls routes by name and parses responses with the
// same schemas.

export type Endpoint = {
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
	/** `:name` marks a path parameter, validated by `params`. */
	path: `/api/app/v1/${string}`
	/** `user`: a Supabase access token as `Authorization: Bearer …`. */
	auth: 'user' | 'public'
	query?: z.ZodType
	params?: z.ZodType
	body?: z.ZodType
	response: z.ZodType
	/** The success status. A POST that finds its `id` already created answers 200. */
	status: 200 | 201
}

export const endpoints = {
	startClass: {
		method: 'POST',
		path: '/api/app/v1/classes',
		auth: 'user',
		body: startClassBody,
		response: classResponse,
		status: 201
	},
	answerTurn: {
		method: 'POST',
		path: '/api/app/v1/classes/:id/turns/:turn',
		auth: 'user',
		params: classTurnParams,
		body: answerTurnBody,
		response: classResponse,
		status: 200
	},
	openClass: {
		method: 'GET',
		path: '/api/app/v1/classes/open',
		auth: 'user',
		query: openClassQuery,
		response: openClassResponse,
		status: 200
	},
	endClass: {
		method: 'POST',
		path: '/api/app/v1/classes/:id/end',
		auth: 'user',
		params: classParams,
		body: endClassBody,
		response: classResponse,
		status: 200
	},
	readVideo: {
		method: 'POST',
		path: '/api/app/v1/videos',
		auth: 'user',
		body: readVideoBody,
		response: readVideoResponse,
		status: 200
	},
	getConfig: {
		method: 'GET',
		path: '/api/app/v1/config',
		auth: 'public',
		response: appConfigSchema,
		status: 200
	},
	getProfile: {
		method: 'GET',
		path: '/api/app/v1/profile',
		auth: 'user',
		response: profileResponse,
		status: 200
	},
	updateProfile: {
		method: 'PATCH',
		path: '/api/app/v1/profile',
		auth: 'user',
		body: updateProfileBody,
		response: profileResponse,
		status: 200
	},
	listItems: {
		method: 'GET',
		path: '/api/app/v1/items',
		auth: 'user',
		query: listItemsQuery,
		response: listItemsResponse,
		status: 200
	},
	getItem: {
		method: 'GET',
		path: '/api/app/v1/items/:id',
		auth: 'user',
		params: itemParams,
		response: itemResponse,
		status: 200
	},
	createItem: {
		method: 'POST',
		path: '/api/app/v1/items',
		auth: 'user',
		body: createItemBody,
		response: itemResponse,
		status: 201
	},
	listTasks: {
		method: 'GET',
		path: '/api/app/v1/tasks',
		auth: 'user',
		query: listTasksQuery,
		response: listTasksResponse,
		status: 200
	},
	createTask: {
		method: 'POST',
		path: '/api/app/v1/tasks',
		auth: 'user',
		body: createTaskBody,
		response: taskResponse,
		status: 201
	},
	listActivity: {
		method: 'GET',
		path: '/api/app/v1/activity',
		auth: 'user',
		query: listActivityQuery,
		response: listActivityResponse,
		status: 200
	},
	listNotifications: {
		method: 'GET',
		path: '/api/app/v1/notifications',
		auth: 'user',
		query: listNotificationsQuery,
		response: listNotificationsResponse,
		status: 200
	},
	deleteAccount: {
		method: 'DELETE',
		path: '/api/app/v1/account',
		auth: 'user',
		response: deleteAccountResponse,
		status: 200
	},
	createUpload: {
		method: 'POST',
		path: '/api/app/v1/uploads',
		auth: 'user',
		body: createUploadBody,
		response: createUploadResponse,
		status: 201
	}
} as const satisfies Record<string, Endpoint>

export type EndpointName = keyof typeof endpoints
