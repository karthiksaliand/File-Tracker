import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

function getBaseUrl(): string {
  // On web: ALWAYS use the current origin — this ensures the web app
  // talks to its own backend whether on preview or deployed URL
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  // On mobile (APK): use the env variable set at build time
  // IMPORTANT: When building APK, set EXPO_PUBLIC_BACKEND_URL in frontend/.env
  // to match the deployed website URL (e.g., https://your-deployed-url.com)
  return process.env.EXPO_PUBLIC_BACKEND_URL || '';
}

const BASE_URL = getBaseUrl();

export async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const token = await AsyncStorage.getItem('auth_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${BASE_URL}/api${endpoint}`;
  console.log('[API]', options.method || 'GET', url);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Network error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}
