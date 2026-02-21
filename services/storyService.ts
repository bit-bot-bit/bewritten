import { apiDelete, apiGet, apiPost, apiPut } from './apiClient';
import { StoryState, StorySnapshot } from '../types';

export interface StoryService {
  clearSession(): void;
  authenticate(email: string, password: string, mode: 'login' | 'register'): Promise<any>;
  listOAuthProviders(): Promise<any[]>;
  authenticateWithOAuth(providerId: string): Promise<any>;
  fetchCurrentUser(): Promise<any>;
  changeCurrentUserPassword(current: string, newPass: string): Promise<any>;
  fetchUserSettings(): Promise<any>;
  saveUserSettings(settings: any, options?: { keepExistingKey?: boolean }): Promise<any>;
  listStories(): Promise<any[]>;
  fetchStoryById(storyId: string): Promise<any>;
  createStoryForUser(story: any): Promise<any>;
  saveStoryForUser(story: any): Promise<any>;
  syncStoriesForUser(stories: any[]): Promise<any>;
  deleteStoryForUser(storyId: string): Promise<any>;
  exportAccountBackup(): Promise<any>;
  importAccountBackup(backup: any, mode?: string): Promise<any>;
}

export class RestStoryService implements StoryService {
  clearSession() {
    localStorage.removeItem('mythos_token');
  }

  async authenticate(email, password, mode) {
    const endpoint = mode === 'register' ? '/auth/register' : '/auth/login';
    const data = await apiPost(endpoint, { email, password });
    localStorage.setItem('mythos_token', data.token);
    return data.user;
  }

  async listOAuthProviders() {
    const data = await apiGet('/auth/providers');
    return data.providers || [];
  }

  async authenticateWithOAuth(providerId) {
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

  async fetchCurrentUser() {
    const data = await apiGet('/auth/me');
    return data.user;
  }

  async changeCurrentUserPassword(currentPassword, newPassword) {
    const data = await apiPost('/auth/change-password', { currentPassword, newPassword });
    return data.user;
  }

  async fetchUserSettings() {
    const data = await apiGet('/user/settings');
    return data.settings;
  }

  async saveUserSettings(settings, options: { keepExistingKey?: boolean } = {}) {
    const keepExistingKey = options.keepExistingKey ?? true;
    const data = await apiPut('/user/settings', { settings, keepExistingKey });
    return data.settings;
  }

  async listStories() {
    const data = await apiGet('/stories');
    return data.stories;
  }

  async fetchStoryById(storyId) {
    const data = await apiGet(`/stories/${encodeURIComponent(storyId)}`);
    return data.story;
  }

  async createStoryForUser(story) {
    const data = await apiPost('/stories', { story });
    return data.story;
  }

  async saveStoryForUser(story) {
    const data = await apiPut(`/stories/${encodeURIComponent(story.id)}`, { story });
    return data.story;
  }

  async syncStoriesForUser(stories) {
    return apiPost('/stories/sync', { stories });
  }

  async deleteStoryForUser(storyId) {
    const data = await apiDelete(`/stories/${encodeURIComponent(storyId)}`);
    return data.deleted;
  }

  async exportAccountBackup() {
    const data = await apiGet('/account/backup');
    return data.backup;
  }

  async importAccountBackup(backup, mode = 'merge') {
    const data = await apiPost('/account/restore', { backup, mode });
    return data.result;
  }
}

let currentStoryService: StoryService = new RestStoryService();

export function setStoryService(service: StoryService) {
  currentStoryService = service;
}

export function getStoryService(): StoryService {
  return currentStoryService;
}

// Proxy exports
export function clearSession() {
  return currentStoryService.clearSession();
}

export function authenticate(email, password, mode) {
  return currentStoryService.authenticate(email, password, mode);
}

export function listOAuthProviders() {
  return currentStoryService.listOAuthProviders();
}

export function authenticateWithOAuth(providerId) {
  return currentStoryService.authenticateWithOAuth(providerId);
}

export function fetchCurrentUser() {
  return currentStoryService.fetchCurrentUser();
}

export function changeCurrentUserPassword(current, newPass) {
  return currentStoryService.changeCurrentUserPassword(current, newPass);
}

export function fetchUserSettings() {
  return currentStoryService.fetchUserSettings();
}

export function saveUserSettings(settings, options) {
  return currentStoryService.saveUserSettings(settings, options);
}

export function listStories() {
  return currentStoryService.listStories();
}

export function fetchStoryById(id) {
  return currentStoryService.fetchStoryById(id);
}

export function createStoryForUser(story) {
  return currentStoryService.createStoryForUser(story);
}

export function saveStoryForUser(story) {
  return currentStoryService.saveStoryForUser(story);
}

export function syncStoriesForUser(stories) {
  return currentStoryService.syncStoriesForUser(stories);
}

export function deleteStoryForUser(id) {
  return currentStoryService.deleteStoryForUser(id);
}

export function exportAccountBackup() {
  return currentStoryService.exportAccountBackup();
}

export function importAccountBackup(backup, mode) {
  return currentStoryService.importAccountBackup(backup, mode);
}
