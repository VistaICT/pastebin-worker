import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import Header from '@/components/header';
import Footer from '@/components/footer';
import { ThemeProvider } from '@/context/theme';

export default function AppLayout() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <Header />
        <main role="main" className="flex-1">
          <Suspense fallback={<RouteFallback />}>{/* Keep the shell stable while route chunks load. */}
            <Outlet />
          </Suspense>
        </main>
        <Footer />
        <Toaster position="top-center" reverseOrder={false} />
      </div>
    </ThemeProvider>
  );
}

function RouteFallback() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="animate-pulse space-y-6">
        <div className="space-y-3 sm:space-y-4">
          <div className="h-6 w-40 rounded-full bg-gray-200 dark:bg-gray-800" />
          <div className="h-10 w-3/4 rounded-xl bg-gray-200 dark:bg-gray-800 sm:h-14" />
          <div className="h-5 w-full rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="h-5 w-5/6 rounded-lg bg-gray-200 dark:bg-gray-800" />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-6 flex items-center justify-between border-b border-gray-200 pb-4 dark:border-gray-800">
            <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
          <div className="space-y-4">
            <div className="h-10 w-full rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800" />
              <div className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="h-56 rounded-xl bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>
      </div>
    </div>
  );
}
