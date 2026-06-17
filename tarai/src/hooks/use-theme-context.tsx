import { createContext, useContext, useState, ReactNode } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  resolvedScheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'system',
  setThemeMode: () => {},
  resolvedScheme: 'light',
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useRNColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');

  const resolvedScheme =
    themeMode === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : themeMode;

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, resolvedScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  return useContext(ThemeContext);
}
