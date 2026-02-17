import { apiDelete, apiGet, apiPost, apiPut } from './apiClient';
import { StoryState, StorySnapshot } from '../types';

export function clearSession() {
  localStorage.removeItem('mythos_token');
}

export async function authenticate(email, password, mode) {
  const endpoint = mode === 'register' ? '/auth/register' : '/auth/login';
  const data = await apiPost(endpoint, { email, password });
  localStorage.setItem('mythos_token', data.token);
  return data.user;
}

export async function listOAuthProviders() {
  const data = await apiGet('/auth/providers');
  return data.providers || [];
}

export async function authenticateWithOAuth(providerId) {
  const returnTo = window.location.origin;
  const popupUrl = `/api/auth/oauth/${encodeURIComponent(providerId)}/start?return_to=${encodeURIComponent(returnTo)}`;
  const popup = window.open(popupUrl, 'bewritten_oauth', 'width=540,height=720,menubar=no,toolbar=no,status=no');
  if (!popup) throw new Error('Popup blocked by browser');

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('OAuth sign-in timed out'));
    }, 120000);

    const poll = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('OAuth window was closed'));
      }
    }, 500);

    function cleanup() {
      window.clearTimeout(timeout);
      window.clearInterval(poll);
      window.removeEventListener('message', onMessage);
    }

    function onMessage(event) {
      if (event.origin !== window.location.origin) return;
      if (event.source !== popup) return;
      const data = event.data;
      if (!data || data.type !== 'bewritten_oauth_result') return;
      cleanup();

      if (!data.ok || !data.session?.token || !data.session?.user?.email) {
        reject(new Error(data.error || 'OAuth authentication failed'));
        return;
      }

      localStorage.setItem('mythos_token', data.session.token);
      resolve(data.session.user);
    }

    window.addEventListener('message', onMessage);
  });
}

export async function fetchCurrentUser() {
  const data = await apiGet('/auth/me');
  return data.user;
}

export async function changeCurrentUserPassword(currentPassword, newPassword) {
  const data = await apiPost('/auth/change-password', { currentPassword, newPassword });
  return data.user;
}

export async function fetchUserSettings() {
  const data = await apiGet('/user/settings');
  return data.settings;
}

export async function saveUserSettings(settings, options: { keepExistingKey?: boolean } = {}) {
  const keepExistingKey = options.keepExistingKey ?? true;
  const data = await apiPut('/user/settings', { settings, keepExistingKey });
  return data.settings;
}

export async function listStories() {
  const data = await apiGet('/stories');
  return data.stories;
}

export async function fetchStoryById(storyId) {
  const data = await apiGet(`/stories/${encodeURIComponent(storyId)}`);
  return data.story;
}

export async function createStoryForUser(story) {
  const data = await apiPost('/stories', { story });
  return data.story;
}

export async function saveStoryForUser(story) {
  const data = await apiPut(`/stories/${encodeURIComponent(story.id)}`, { story });
  return data.story;
}

export async function syncStoriesForUser(stories) {
  return apiPost('/stories/sync', { stories });
}

export async function deleteStoryForUser(storyId) {
  const data = await apiDelete(`/stories/${encodeURIComponent(storyId)}`);
  return data.deleted;
}

export async function exportAccountBackup() {
  const data = await apiGet('/account/backup');
  return data.backup;
}

export async function importAccountBackup(backup, mode = 'merge') {
  const data = await apiPost('/account/restore', { backup, mode });
  return data.result;
}
