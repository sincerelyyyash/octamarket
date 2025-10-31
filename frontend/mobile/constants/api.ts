export const API_BASE_URL = 'http://192.168.1.12:3001';

type Json = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

export const apiFetch = async <T = any>(path: string, init?: RequestInit): Promise<T> => {
  const url = `${API_BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      ...init,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${text || res.statusText}`);
    }
    return (await res.json()) as T;
  } catch (err: any) {
    const message = (err?.message || '').toLowerCase();
    if (message.includes('network request failed') || message.includes('networkerror') || message.includes('failed to fetch')) {
      throw new Error('Unable to reach the server. Please check your connection and try again.');
    }
    throw err;
  }
};


