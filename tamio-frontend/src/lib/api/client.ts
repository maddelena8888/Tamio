// ============================================================================
// API Client for Tamio Backend
// ============================================================================

import type { ApiError } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Token management
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) {
    localStorage.setItem('tamio_token', token);
  } else {
    localStorage.removeItem('tamio_token');
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  accessToken = localStorage.getItem('tamio_token');
  return accessToken;
}

export function clearAuth() {
  accessToken = null;
  localStorage.removeItem('tamio_token');
  localStorage.removeItem('tamio_user');
}

// API Error class
export class ApiClientError extends Error {
  status: number;
  detail: string;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.detail = detail || message;
  }
}

// Core fetch wrapper
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAccessToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json();

  if (!response.ok) {
    const error = data as ApiError;
    throw new ApiClientError(
      error.detail || 'An error occurred',
      response.status,
      error.detail
    );
  }

  return data as T;
}

// HTTP methods
export const api = {
  get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = params
      ? `${endpoint}?${new URLSearchParams(params).toString()}`
      : endpoint;
    return apiFetch<T>(url, { method: 'GET' });
  },

  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return apiFetch<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(endpoint: string, body?: unknown): Promise<T> {
    return apiFetch<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return apiFetch<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(endpoint: string): Promise<T> {
    return apiFetch<T>(endpoint, { method: 'DELETE' });
  },
};

export default api;
