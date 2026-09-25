import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  variant?: 'icon' | 'button' | 'pill' | 'segmented';
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'icon',
  className = '',
  showLabel = false,
}) => {
  const { theme, toggleTheme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  if (variant === 'segmented') {
    return (
      <div className={`inline-flex p-1 rounded bg-[#141414] border border-[#262626] ${className}`}>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
            isDark
              ? 'bg-[#1A1A1A] text-[#D4AF37] border border-[#333333] shadow-sm'
              : 'text-[#808080] hover:text-white'
          }`}
          aria-label="Activate Dark Mode"
        >
          <Moon className="w-3.5 h-3.5" />
          <span>Dark Mode</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
            !isDark
              ? 'bg-[#1A1A1A] text-[#D4AF37] border border-[#333333] shadow-sm'
              : 'text-[#808080] hover:text-white'
          }`}
          aria-label="Activate Light Mode"
        >
          <Sun className="w-3.5 h-3.5" />
          <span>Light Mode</span>
        </button>
      </div>
    );
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`flex items-center gap-2 px-3 py-1.5 rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] text-xs font-medium text-[#E0E0E0] transition-colors ${className}`}
        aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
      >
        {isDark ? (
          <>
            <Sun className="w-4 h-4 text-[#D4AF37]" />
            {showLabel && <span>Light Mode</span>}
          </>
        ) : (
          <>
            <Moon className="w-4 h-4 text-[#A37508]" />
            {showLabel && <span>Dark Mode</span>}
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] text-[#E0E0E0] hover:text-white transition-all flex items-center justify-center ${className}`}
      aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-[#D4AF37]" />
      ) : (
        <Moon className="w-4 h-4 text-[#A37508]" />
      )}
      {showLabel && (
        <span className="ml-2 text-xs font-medium">{isDark ? 'Light' : 'Dark'}</span>
      )}
    </button>
  );
};
