import { useState } from 'react';
import type { User } from 'firebase/auth';
import { useTheme } from '../contexts/ThemeContext';

interface MobileHeaderProps {
  user: User | null;
  authLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onShowSettings?: () => void;
}

/**
 * Mobile-optimized header with user avatar (Google Finance style)
 */
export const MobileHeader = ({ user, authLoading, onSignIn, onSignOut, onShowSettings }: MobileHeaderProps) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-40">
      <div className="px-4 py-3 flex items-center justify-between">
        {/* App title with logo */}
        <div className="flex items-center gap-2">
          <img src="/assets/ccc-logo.png" alt="CCC Logo" className="h-6 w-auto" />
          <h1 className="text-lg font-bold">
            <span className="text-gray-900 dark:text-white">Market</span>{' '}
            <span className="text-blue-600 dark:text-blue-400">Pulse</span>
          </h1>
        </div>

        {/* Right side - Dark mode toggle + Auth */}
        <div className="flex items-center gap-3">
          {/* Dark mode toggle - always visible */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            aria-label="Toggle theme"
          >
            <span className="text-lg">{theme === 'dark' ? '🌙' : '☀️'}</span>
          </button>

          {/* Auth section */}
          <div className="relative">
            {authLoading ? (
              <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-slate-700 animate-pulse"></div>
            ) : user ? (
              <>
                {/* User avatar button */}
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="w-9 h-9 rounded-full overflow-hidden border-2 border-gray-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                      {(user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()}
                    </div>
                  )}
                </button>

              {/* User menu dropdown */}
              {showUserMenu && (
                <>
                  {/* Backdrop to close menu */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  ></div>

                  {/* Menu */}
                  <div className="absolute right-0 top-12 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-xl dark:shadow-slate-900 border border-gray-200 dark:border-slate-700 py-2 z-50 animate-fadeIn">
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {user.displayName || 'User'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                    </div>

                    {/* Menu items */}
                    <div className="py-1">
                      {/* Settings button */}
                      {onShowSettings && (
                        <button
                          onClick={() => {
                            onShowSettings();
                            setShowUserMenu(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                          <span>⚙️</span>
                          <span>Settings</span>
                        </button>
                      )}

                      {/* Sign out button */}
                      <button
                        onClick={() => {
                          onSignOut();
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                      >
                        <span>🚪</span>
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
            ) : (
              /* Sign in button for non-authenticated users */
              <button
                onClick={onSignIn}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
