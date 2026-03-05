import React, { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";

export const ThemeSwitcher: React.FC = () => {
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    return (localStorage.getItem("theme") as any) || "system";
  });

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (t: "light" | "dark") => {
      // Sync UI theme update on the root element
      if (t === "dark") {
        root.classList.add("dark");
        // Explicitly set the color scheme as well
        root.style.colorScheme = "dark";
      } else {
        root.classList.remove("dark");
        root.style.colorScheme = "light";
      }

      // Async Native status bar update
      if (Capacitor.isNativePlatform()) {
        if (t === "dark") {
          // Style.Dark = light (white) text/icons on a dark background
          StatusBar.setStyle({ style: Style.Dark }).catch(console.error);
          StatusBar.setBackgroundColor({ color: "#0f172a" }).catch(
            console.error,
          );
        } else {
          // Style.Light = dark text/icons on a light background
          StatusBar.setStyle({ style: Style.Light }).catch(console.error);
          StatusBar.setBackgroundColor({ color: "#ffffff" }).catch(
            console.error,
          );
        }
      }
    };

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const updateSystemTheme = (isDark: boolean) =>
        applyTheme(isDark ? "dark" : "light");

      updateSystemTheme(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) =>
        updateSystemTheme(e.matches);
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      applyTheme(theme);
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
      {[
        { id: "light", icon: Sun, label: "Light" },
        { id: "system", icon: Monitor, label: "System" },
        { id: "dark", icon: Moon, label: "Dark" },
      ].map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id as any)}
          aria-label={t.label}
          className={`p-1.5 rounded-lg transition-all ${
            theme === t.id
              ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          }`}
        >
          <t.icon size={16} />
        </button>
      ))}
    </div>
  );
};
