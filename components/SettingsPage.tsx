import React from 'react';
import { UserSettings } from './UserSettings';
import { AdminSettings } from './AdminSettings';
import { AccountBackupSettings } from './AccountBackupSettings';

export const SettingsPage = ({ isAdmin, onRestoreComplete }) => {
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto h-full overflow-y-auto overflow-x-hidden space-y-6">
      <h2 className="text-2xl md:text-3xl font-bold text-main">Settings</h2>
      <UserSettings />
      <AccountBackupSettings onRestoreComplete={onRestoreComplete} />
      {isAdmin && <AdminSettings compact />}
    </div>
  );
};
