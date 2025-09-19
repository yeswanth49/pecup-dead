'use client'

import type { CachedProfile } from './simple-cache'
import type { EnhancedProfileDynamicData, EnhancedProfileStaticData } from './enhanced-profile-context'

type SubjectsItem = { id: string; code: string; name: string; resource_type?: string }

export interface BulkCachePayload {
	profile?: CachedProfile
	dynamic?: EnhancedProfileDynamicData
	static?: EnhancedProfileStaticData
	subjects?: SubjectsItem[]
	subjectsContext?: { branch: string; year: number; semester: number }
}

interface BulkCacheMessage {
	type: 'bulk-cache-update'
	senderId: string
	email?: string
	payload?: BulkCachePayload
	timestamp: number
}

const CHANNEL_NAME = 'pecup_bulk_cache_sync'
const STORAGE_FALLBACK_KEY = 'broadcast:pecup_bulk_cache_sync'

let channel: BroadcastChannel | null = null

function isValidBulkCacheMessage(obj: unknown): obj is BulkCacheMessage {
	if (!obj || typeof obj !== 'object') return false
	const anyObj = obj as Record<string, unknown>
	if (anyObj.type !== 'bulk-cache-update') return false
	if (typeof anyObj.senderId !== 'string') return false
	if (typeof anyObj.timestamp !== 'number') return false
	if ('email' in anyObj && anyObj.email != null && typeof anyObj.email !== 'string') return false
	if ('payload' in anyObj && anyObj.payload != null && typeof anyObj.payload !== 'object') return false
	return true
}

function getTabId(): string {
	if (typeof window === 'undefined') return 'server'
	try {
		const existing = sessionStorage.getItem('pecup_tab_id')
		if (existing) return existing
		const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`
		sessionStorage.setItem('pecup_tab_id', id)
		return id
	} catch {
		return `${Date.now()}_${Math.random()}`
	}
}

function getChannel(): BroadcastChannel | null {
	if (typeof window === 'undefined') return null
	if (typeof BroadcastChannel === 'undefined') return null
	if (!channel) channel = new BroadcastChannel(CHANNEL_NAME)
	return channel
}

export function broadcastBulkCacheUpdate(email: string, payload: BulkCachePayload) {
	if (typeof window === 'undefined') return
	const message: BulkCacheMessage = {
		type: 'bulk-cache-update',
		senderId: getTabId(),
		email,
		payload,
		timestamp: Date.now()
	}

	const ch = getChannel()
	if (ch) {
		try { ch.postMessage(message) } catch (_) {}
		return
	}

	// Fallback via localStorage storage event (fires on other tabs)
	try {
		localStorage.setItem(STORAGE_FALLBACK_KEY, JSON.stringify(message))
		// cleanup soon after to avoid clutter
		setTimeout(() => {
			try { localStorage.removeItem(STORAGE_FALLBACK_KEY) } catch (_) {}
		}, 0)
	} catch (_) {}
}

export function subscribeToBulkCacheUpdates(onMessage: (msg: BulkCacheMessage) => void): () => void {
	if (typeof window === 'undefined') return () => {}

	const selfId = getTabId()

	const ch = getChannel()
	let storageHandler: ((ev: StorageEvent) => void) | null = null

	if (ch) {
		const handler = (msg: MessageEvent) => {
			const raw = msg?.data
			if (!raw || typeof raw !== 'object') return
			if (!isValidBulkCacheMessage(raw)) return
			if (raw.senderId === selfId) return
			onMessage(raw)
		}
		ch.addEventListener('message', handler as EventListener)
		return () => {
			try { ch.removeEventListener('message', handler as EventListener) } catch (_) {}
		}
	}

	// Fallback via storage events
	storageHandler = (ev: StorageEvent) => {
		if (ev.key !== STORAGE_FALLBACK_KEY) return
		if (!ev.newValue) return
		try {
			const parsed = JSON.parse(ev.newValue) as unknown
			if (!isValidBulkCacheMessage(parsed)) return
			if (parsed.senderId === selfId) return
			onMessage(parsed)
		} catch (_) {}
	}
	window.addEventListener('storage', storageHandler)
	return () => { try { window.removeEventListener('storage', storageHandler!) } catch (_) {} }
}

export function getCurrentTabId(): string { return getTabId() }


