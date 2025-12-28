// ============================================================================
// Authentication API
// ============================================================================

import api, { setAccessToken, clearAuth } from './client';
import type { AuthResponse, LoginRequest, SignupRequest, User } from './types';

export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/login', credentials);
  setAccessToken(response.access_token);
  localStorage.setItem('tamio_user', JSON.stringify(response.user));
  return response;
}

export async function signup(credentials: SignupRequest): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/signup', credentials);
  setAccessToken(response.access_token);
  localStorage.setItem('tamio_user', JSON.stringify(response.user));
  return response;
}

export async function getCurrentUser(): Promise<User> {
  return api.get<User>('/auth/me');
}

export async function refreshToken(): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/refresh');
  setAccessToken(response.access_token);
  localStorage.setItem('tamio_user', JSON.stringify(response.user));
  return response;
}

export async function completeOnboarding(): Promise<User> {
  return api.post<User>('/auth/complete-onboarding');
}

export function logout() {
  clearAuth();
}

export function getStoredUser(): User | null {
  const stored = localStorage.getItem('tamio_user');
  if (!stored) return null;
  try {
    return JSON.parse(stored) as User;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('tamio_token');
}
