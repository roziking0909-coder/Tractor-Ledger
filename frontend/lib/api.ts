/**
 * Tractor Ledger — API Client
 * Backend base URL from EXPO_PUBLIC_API_URL (default http://127.0.0.1:8000)
 */

const API_BASE = (process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
export const API_V1 = `${API_BASE}/api/v1`;
import { ensureSessionValid } from '@/lib/supabase';

export function isApiConfigured(): boolean {
  return API_BASE.length > 0 && !API_BASE.includes('8081');
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (token) {
    try {
      await ensureSessionValid();
    } catch (e) {
      console.warn('[API] Token refresh check failed:', e);
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_V1}${path}`, {
    ...rest,
    headers,
  });

  let data: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }

  if (!response.ok) {
    const detail =
      typeof data === 'object' && data !== null && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : response.statusText;
    throw new ApiError(detail || 'Request failed', response.status, detail);
  }

  return data as T;
}
