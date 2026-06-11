import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
} from 'react';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
  const theme: Theme = 'dark';

  useEffect(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('kup50-theme', 'dark');
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: () => undefined,
      toggleTheme: () => undefined,
    }),
    [],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
