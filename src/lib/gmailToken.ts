
// src/lib/gmailToken.ts
import { supabase } from './supabase';

const TOKEN_EXPIRY_THRESHOLD_MS = 50 * 60 * 1000; // 50 minutes in milliseconds

export async function ensureValidGmailToken(userId: string): Promise<string> {
  try {
    // 1. Fetch the user's profile from the Supabase profiles table
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('gmail_access_token, gmail_access_token_updated_at, updated_at')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Supabase error fetching profile:', error);
      return '';
    }

    if (!profile) {
      console.error('Profile not found for userId:', userId);
      return '';
    }

    const { gmail_access_token, gmail_access_token_updated_at, updated_at } = profile;

    if (!gmail_access_token) {
      console.warn('No gmail_access_token found for userId:', userId);
      // Attempt to refresh if no token exists, as it might be the first time
      // or an old token was cleared. The API will handle the refresh token lookup.
      const newToken = await callRefreshTokenApi(userId);
      return newToken;
    }

    const lastUpdated = gmail_access_token_updated_at || updated_at;

    if (lastUpdated) {
      const lastUpdatedDate = new Date(lastUpdated);
      const now = new Date();
      const age = now.getTime() - lastUpdatedDate.getTime();

      // 2. Check if the current token is older than 50 minutes
      if (age > TOKEN_EXPIRY_THRESHOLD_MS) {
        console.log('Gmail access token is older than 50 minutes. Refreshing...');
        // 3. If the token is older than 50 minutes: call the API endpoint
        const newToken = await callRefreshTokenApi(userId);
        return newToken;
      }
    }

    // 4. If the token is valid, simply return the existing gmail_access_token
    return gmail_access_token;

  } catch (err) {
    console.error('Unexpected error in ensureValidGmailToken:', err);
    return '';
  }
}

async function callRefreshTokenApi(userId: string): Promise<string> {
  try {
    const response = await fetch('/api/refresh-gmail-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API call to refresh-gmail-token failed:', response.status, errorData);
      return '';
    }

    const { access_token } = await response.json();
    return access_token || '';
  } catch (apiError) {
    console.error('Network or API parsing error during token refresh:', apiError);
    return '';
  }
}
