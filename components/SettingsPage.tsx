import React from 'react';
import { UserSettings } from './UserSettings';
import { AdminSettings } from './AdminSettings';

export const SettingsPage = ({ isAdmin }) => {
  return (
    <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto space-y-6">
      <h2 className="text-3xl font-bold text-main">Settings</h2>
      <UserSettings />
      {isAdmin && <AdminSettings compact />}
    </div>
  );
};
