import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

function getBaseUrl(): string {
  // On web: use the current domain (works for any deployed URL automatically)
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  // On mobile (APK): use the configured or fallback URL
  return process.env.EXPO_PUBLIC_BACKEND_URL || 'https://dept-workflow-2.preview.emergentagent.com';
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
