import { Link } from 'react-router-dom';
import { Moon, Sun, LogIn, LogOut, User, Lock, Monitor, Check } from 'lucide-react';
import { useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/theme';
import { useAuth } from '@/context/auth';
import ShareHistorySidebar from './share-history-sidebar';

export default function Header() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white group-hover:bg-brand-700 transition-colors">
            <Lock size={16} strokeWidth={2.5} />
          </div>
          <span className="text-xl font-semibold text-gray-900 dark:text-gray-50">Lockbox</span>
          <span className="hidden sm:inline-block text-xs text-gray-400 dark:text-gray-600 font-medium">
            by Vista
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {/* History */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setHistoryOpen(true)}
            className="text-gray-500 dark:text-gray-400 dark:hover:text-gray-50"
            title="Share history"
            aria-label="Open share history"
          >
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </Button>

          {/* Theme */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-gray-500 dark:text-gray-400 dark:hover:text-gray-50"
                title="Theme"
                aria-label="Theme settings"
              >
                {theme === 'system'
                  ? <Monitor size={18} />
                  : resolvedTheme === 'dark'
                    ? <Moon size={18} />
                    : <Sun size={18} />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem className="cursor-pointer" onSelect={() => setTheme('light')}>
                <Sun size={14} className="mr-2" />
                Light
                {theme === 'light' && <Check size={14} className="ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onSelect={() => setTheme('dark')}>
                <Moon size={14} className="mr-2" />
                Dark
                {theme === 'dark' && <Check size={14} className="ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onSelect={() => setTheme('system')}>
                <Monitor size={14} className="mr-2" />
                System
                {theme === 'system' && <Check size={14} className="ml-auto" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Auth */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" className="h-auto gap-1.5 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300">
                  <User size={16} />
                  <span className="hidden sm:inline max-w-[140px] truncate">{user.name ?? user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                  {user.email}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 dark:text-red-400"
                  onSelect={() => logout()}
                >
                  <LogOut size={14} className="mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <a href="/auth/login">
              <Button size="sm" variant="outline" className="gap-1.5">
                <LogIn size={14} />
                Sign in
              </Button>
            </a>
          )}
        </nav>
      </div>

      <ShareHistorySidebar open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </header>
  );
}
