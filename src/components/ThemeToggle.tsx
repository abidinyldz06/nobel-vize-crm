"use client"
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-200 hover:bg-white/5 border border-transparent w-full text-left"
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-4 h-4 shrink-0 text-amber-400" />
          Aydınlık Mod
        </>
      ) : (
        <>
          <Moon className="w-4 h-4 shrink-0 text-blue-400" />
          Karanlık Mod
        </>
      )}
    </button>
  );
}
