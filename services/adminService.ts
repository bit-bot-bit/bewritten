import { apiGet, apiPut, apiDelete } from './apiClient';

export interface AdminService {
  getSettings(): Promise<any>;
  updateRegistration(enabled: boolean): Promise<any>;
  updateUserLock(email: string, locked: boolean): Promise<any>;
  updateUserRole(email: string, role: string): Promise<any>;
  updateUserTier(email: string, tier: string): Promise<any>;
  updateUserCredits(email: string, balance: number): Promise<any>;
  deleteUser(email: string): Promise<any>;
  resetUserPassword(email: string, password: string): Promise<any>;
  updateMonetization(payload: any): Promise<any>;
}

export class RestAdminService implements AdminService {
  async getSettings() {
    return apiGet('/admin/settings');
  }

  async updateRegistration(enabled: boolean) {
    return apiPut('/admin/settings/registration', { enabled });
  }

  async updateUserLock(email: string, locked: boolean) {
    return apiPut(`/admin/users/${encodeURIComponent(email)}/lock`, { locked });
  }

  async updateUserRole(email: string, role: string) {
    return apiPut(`/admin/users/${encodeURIComponent(email)}/role`, { role });
  }

  async updateUserTier(email: string, tier: string) {
    return apiPut(`/admin/users/${encodeURIComponent(email)}/tier`, { tier });
  }

  async updateUserCredits(email: string, balance: number) {
    return apiPut(`/admin/users/${encodeURIComponent(email)}/credits`, { balance });
  }

  async deleteUser(email: string) {
    return apiDelete(`/admin/users/${encodeURIComponent(email)}`);
  }

  async resetUserPassword(email: string, password: string) {
    return apiPut(`/admin/users/${encodeURIComponent(email)}/password`, { password });
  }

  async updateMonetization(payload: any) {
    return apiPut('/admin/settings/monetization', payload);
  }
}

let currentAdminService: AdminService = new RestAdminService();

export function setAdminService(service: AdminService) {
  currentAdminService = service;
}

export function getAdminService(): AdminService {
  return currentAdminService;
}

// Proxy exports
export function getAdminSettings() {
  return currentAdminService.getSettings();
}

export function updateRegistration(enabled: boolean) {
  return currentAdminService.updateRegistration(enabled);
}

export function updateUserLock(email: string, locked: boolean) {
  return currentAdminService.updateUserLock(email, locked);
}

export function updateUserRole(email: string, role: string) {
  return currentAdminService.updateUserRole(email, role);
}

export function updateUserTier(email: string, tier: string) {
  return currentAdminService.updateUserTier(email, tier);
}

export function updateUserCredits(email: string, balance: number) {
  return currentAdminService.updateUserCredits(email, balance);
}

export function deleteUser(email: string) {
  return currentAdminService.deleteUser(email);
}

export function resetUserPassword(email: string, password: string) {
  return currentAdminService.resetUserPassword(email, password);
}

export function updateMonetization(payload: any) {
  return currentAdminService.updateMonetization(payload);
}
