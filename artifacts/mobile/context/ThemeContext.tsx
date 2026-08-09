import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '@/constants/colors';

export type ThemeMode = 'system' | 'light' | 'dark';

export type ColorPalette = typeof colors.light & { radius: number };

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  resolvedTheme: 'light' | 'dark';
  isDark: boolean;
  colors: ColorPalette;
}

const STORAGE_KEY = '@scriptvault_theme_mode';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((savedMode) => {
        if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
          setThemeModeState(savedMode as ThemeMode);
        }
      })
      .catch((err) => {
        console.warn('Failed to load saved theme mode:', err);
      })
      .finally(() => {
        setIsLoaded(true);
      });
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
    } catch (err) {
      console.warn('Failed to save theme mode:', err);
    }
  };

  const resolvedTheme: 'light' | 'dark' =
    themeMode === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : themeMode;

  const activePalette = resolvedTheme === 'dark' ? colors.dark : colors.light;

  const currentColors: ColorPalette = {
    ...activePalette,
    radius: colors.radius,
  };

  const isDark = resolvedTheme === 'dark';

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
        resolvedTheme,
        isDark,
        colors: currentColors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback if rendered outside ThemeProvider
    const systemScheme = useColorScheme();
    const resolvedTheme = systemScheme === 'dark' ? 'dark' : 'light';
    const activePalette = resolvedTheme === 'dark' ? colors.dark : colors.light;
    const currentColors: ColorPalette = { ...activePalette, radius: colors.radius };

    return {
      themeMode: 'system' as ThemeMode,
      setThemeMode: async () => {},
      resolvedTheme,
      isDark: resolvedTheme === 'dark',
      colors: currentColors,
    };
  }
  return context;
}
