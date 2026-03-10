import React from 'react';

import { Settings } from '~/utils/config/settings';

interface SettingsContextValue {
    settings: Settings;
}

const SettingsContext = React.createContext<SettingsContextValue | null>(null);

/**
 * Hook to access settings from any component
 * Throws if used outside SettingsProvider
 */
export const useSettings = (): SettingsContextValue => {
    const context = React.useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within SettingsProvider');
    }
    return context;
};

interface SettingsProviderProps {
    children: React.ReactNode;
    settings: Settings;
}

/**
 * Provider for settings context
 * Makes settings available to all child components
 */
export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children, settings }) => {
    const value: SettingsContextValue = { settings };

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
