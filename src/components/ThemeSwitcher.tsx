import React, { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

export const ThemeSwitcher: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('theme') as any) || 'system';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = async (t: 'light' | 'dark') => {
      if (t === 'dark') {
        root.classList.add('dark');
        if (Capacitor.isNativePlatform()) {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#0f172a' }); // slate-950/900
        }
      } else {
        root.classList.remove('dark');
        if (Capacitor.isNativePlatform()) {
          await StatusBar.setStyle({ style: Style.Light });
          await StatusBar.setBackgroundColor({ color: '#f8fafc' }); // slate-50
        }
      }
    };

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      applyTheme(systemTheme);
      
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      applyTheme(theme);
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
      {[
        { id: 'light', icon: Sun },
        { id: 'system', icon: Monitor },
        { id: 'dark', icon: Moon }
      ].map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id as any)}
          className={`p-1.5 rounded-lg transition-all ${
            theme === t.id 
              ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' 
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
          }`}
        >
          <t.icon size={16} />
        </button>
      ))}
    </div>
  );
};
