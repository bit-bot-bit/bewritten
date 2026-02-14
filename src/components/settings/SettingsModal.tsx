import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface AppSettings {
    ai_provider: string;
    ai_base_url?: string;
    ai_api_key?: string;
    ai_model?: string;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [settings, setSettings] = useState<AppSettings>({
        ai_provider: 'none',
        ai_base_url: '',
        ai_api_key: '',
        ai_model: '',
    });

    useEffect(() => {
        if (isOpen) {
            invoke('get_settings').then((res: any) => {
                if (res) {
                    setSettings(res);
                }
            }).catch(console.error);
        }
    }, [isOpen]);

    const handleSave = async () => {
        try {
            await invoke('save_settings', { settings });
            onClose();
        } catch (e) {
            console.error(e);
            alert("Failed to save settings");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center">
            <div className="bg-white p-6 rounded shadow-lg w-96">
                <h2 className="text-xl font-bold mb-4">Settings</h2>

                <div className="mb-4">
                    <label className="block text-sm font-semibold mb-1">AI Provider</label>
                    <select
                        className="w-full border p-2 rounded"
                        value={settings.ai_provider}
                        onChange={(e) => setSettings({...settings, ai_provider: e.target.value})}
                    >
                        <option value="none">None (Offline)</option>
                        <option value="openai">OpenAI</option>
                        <option value="ollama">Ollama (Local)</option>
                        <option value="mock">Mock (Testing)</option>
                    </select>
                </div>

                {settings.ai_provider !== 'none' && settings.ai_provider !== 'mock' && (
                    <>
                        <div className="mb-4">
                            <label className="block text-sm font-semibold mb-1">Base URL</label>
                            <input
                                className="w-full border p-2 rounded"
                                placeholder="https://api.openai.com/v1"
                                value={settings.ai_base_url || ''}
                                onChange={(e) => setSettings({...settings, ai_base_url: e.target.value})}
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-semibold mb-1">API Key</label>
                            <input
                                type="password"
                                className="w-full border p-2 rounded"
                                placeholder="sk-..."
                                value={settings.ai_api_key || ''}
                                onChange={(e) => setSettings({...settings, ai_api_key: e.target.value})}
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-semibold mb-1">Model Name</label>
                            <input
                                className="w-full border p-2 rounded"
                                placeholder="gpt-3.5-turbo"
                                value={settings.ai_model || ''}
                                onChange={(e) => setSettings({...settings, ai_model: e.target.value})}
                            />
                        </div>
                    </>
                )}

                <div className="flex justify-end gap-2 mt-6">
                    <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded" onClick={onClose}>Cancel</button>
                    <button className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded" onClick={handleSave}>Save</button>
                </div>
            </div>
        </div>
    );
};
