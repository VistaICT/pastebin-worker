import { ShieldAlert } from 'lucide-react';
import { useParams } from 'react-router-dom';

import SecretDetailView from '@/components/secret-detail/secret-detail-view';
import SecretComposer from '@/components/secret-composer';
import { useAuth } from '@/context/auth';

export default function HomePage() {
  const { id } = useParams();
  const { user, loading } = useAuth();

  if (id) {
    return <SecretDetailView secretId={id} />;
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {!user && (
          <section aria-label="Intro" className="mb-6 sm:mb-8 space-y-3 sm:space-y-4">
            <>
              <h1 className="text-balance text-3xl font-semibold text-gray-900 dark:text-gray-50 sm:text-4xl md:text-5xl">
                Lockbox — secure secret &amp; file sharing.
              </h1>
              <p className="text-pretty text-base sm:text-lg text-gray-600 dark:text-gray-400">
                Share anything — secrets and files — with Vista securely.
              </p>
            </>
          </section>
        )}

        {!loading && !user && (
          <section aria-label="Authentication notice" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 dark:border-amber-800/40 dark:bg-amber-950/20">
            <ShieldAlert className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" size={18} />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Sign in to create secrets
              </p>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                You need a Vista account to create or upload.{' '}
                <a
                  href="/auth/login"
                  className="underline underline-offset-2 font-medium hover:text-amber-900 dark:hover:text-amber-200"
                >
                  Sign in with Microsoft
                </a>
              </p>
            </div>
          </section>
        )}

        {(loading || user) && (
          <section aria-label="Create secret" className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
            <div className="mb-6 flex items-center justify-between border-b border-gray-200 pb-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-500">
              <span className="font-medium text-gray-700 dark:text-gray-300">Create a new secret</span>
              <span>Text, attachments, or both</span>
            </div>
            <SecretComposer />
          </section>
        )}
      </div>
    </div>
  );
}
