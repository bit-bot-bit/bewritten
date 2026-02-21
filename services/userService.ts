import { apiGet, apiPut } from './apiClient';

export interface UserService {
  getSettings(): Promise<any>;
  updateSettings(settings: any, keepExistingKey?: boolean): Promise<any>;
}

export class RestUserService implements UserService {
  async getSettings() {
    return apiGet('/user/settings');
  }

  async updateSettings(settings: any, keepExistingKey = true) {
    return apiPut('/user/settings', { settings, keepExistingKey });
  }
}

let currentUserService: UserService = new RestUserService();

export function setUserService(service: UserService) {
  currentUserService = service;
}

export function getUserService(): UserService {
  return currentUserService;
}

// Proxy exports
export function getUserSettings() {
  return currentUserService.getSettings();
}

export function updateUserSettings(settings: any, keepExistingKey = true) {
  return currentUserService.updateSettings(settings, keepExistingKey);
}
