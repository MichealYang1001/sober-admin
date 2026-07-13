import type { OpsAccount } from './types'

export const API_BASE_URL = process.env.NEXT_PUBLIC_SOBER_API_BASE_URL || 'http://localhost:5002'

const TOKEN_KEY = 'sober_ops_token'
const ACCOUNT_KEY = 'sober_ops_account'

export function getOpsToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredAccount(): OpsAccount | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(ACCOUNT_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as OpsAccount
  } catch {
    localStorage.removeItem(ACCOUNT_KEY)
    return null
  }
}

export function storeOpsAuth(token: string, account: OpsAccount) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account))
}

export function clearOpsAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ACCOUNT_KEY)
}

function readError(data: unknown, fallback: string) {
  if (!data || typeof data !== 'object') return fallback
  if ('message' in data && typeof data.message === 'string') return data.message
  if ('detail' in data && typeof data.detail === 'string') return data.detail
  if ('detail' in data && data.detail && typeof data.detail === 'object' && 'message' in data.detail && typeof data.detail.message === 'string') {
    return data.detail.message
  }
  return fallback
}

export async function opsFetch<T>(pathname: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = getOpsToken()
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE_URL}${pathname}`, {
    ...init,
    headers,
    cache: 'no-store',
  })

  if (!response.ok) {
    let data: unknown = null
    try {
      data = await response.json()
    } catch {
      data = null
    }
    if (response.status === 401 || response.status === 403) {
      clearOpsAuth()
    }
    throw new Error(readError(data, `Request failed with status ${response.status}`))
  }

  return response.json()
}
