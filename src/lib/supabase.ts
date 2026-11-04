import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

/**
 * Supabase client, or null when the app runs in demo mode.
 * Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env to switch to live mode.
 * The anon (publishable) key is safe in the app; row-level security protects the data.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// The web build pre-renders pages in Node, where there is no window or storage: skip persistence there.
const canPersist = Platform.OS !== 'web' || typeof window !== 'undefined';

export const supabase: SupabaseClient | null = url && anonKey
  ? createClient(url, anonKey, {
    auth: {
      storage: canPersist ? AsyncStorage : undefined,
      autoRefreshToken: canPersist,
      persistSession: canPersist,
      detectSessionInUrl: false,
    },
  })
  : null;

export const isLive = supabase !== null;

// Refresh the session only while the app is in the foreground.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
