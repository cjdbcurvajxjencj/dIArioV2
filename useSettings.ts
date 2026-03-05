import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { AppSettings, GeminiModel } from './types';

const SETTINGS_KEY = 'diario-ai-settings';

const defaultSettings: AppSettings = {
  transcriptionModel: GeminiModel.Flash,
  analysisModel: GeminiModel.Flash,
  apiKey: null,
  theme: 'light',
};

interface SettingsContextType {
  settings: AppSettings;
  setSettings: (newSettings: Partial<AppSettings>) => void;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  setSettings: () => {},
  isLoading: true,
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettingsState] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem(SETTINGS_KEY);
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        
        // Migration from single 'processingModel' to dual models for backward compatibility
        if (parsed.processingModel && !parsed.transcriptionModel && !parsed.analysisModel) {
            parsed.transcriptionModel = parsed.processingModel;
            parsed.analysisModel = parsed.processingModel;
            delete parsed.processingModel;
        }
        
        // Merge with defaults to ensure all keys are present
        setSettingsState({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.error("Failed to load settings from localStorage", error);
    } finally {
        setIsLoading(false);
    }
  }, []);

  const setSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettingsState(prev => {
      const updatedSettings = { ...prev, ...newSettings };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(updatedSettings));
      } catch (error) {
        console.error("Failed to save settings to localStorage", error);
      }
      return updatedSettings;
    });
  }, []);
  
  const value = { settings, setSettings, isLoading };

  return React.createElement(
    SettingsContext.Provider,
    { value: value },
    !isLoading
      ? children
      : React.createElement(
          'div',
          { className: 'flex items-center justify-center h-screen text-slate-600 dark:text-slate-300' },
          'Caricamento impostazioni...'
        )
  );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if(context === undefined){
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}