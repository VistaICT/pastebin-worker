import ReactDOM from 'react-dom/client';

import AppRouter from './router';
import { AuthProvider } from './context/auth';
import './index.css';
import './components/prism-theme.css';

const CHUNK_RELOAD_FLAG = 'lockbox:chunk-reload-attempted';

function isChunkLoadErrorMessage(message: string) {
  const lower = message.toLowerCase();
  return lower.includes('failed to fetch dynamically imported module')
    || lower.includes('importing a module script failed')
    || lower.includes('loading chunk')
    || lower.includes('chunkloaderror');
}

function maybeRecoverFromChunkLoadError(message: string) {
  if (!isChunkLoadErrorMessage(message)) return;
  if (sessionStorage.getItem(CHUNK_RELOAD_FLAG) === '1') return;
  sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
  window.location.reload();
}

window.addEventListener('error', (event) => {
  const message = event?.message ?? '';
  maybeRecoverFromChunkLoadError(message);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = reason instanceof Error
    ? reason.message
    : String(reason ?? '');
  maybeRecoverFromChunkLoadError(message);
});

// Reset the guard once the app bootstraps successfully after reload.
sessionStorage.removeItem(CHUNK_RELOAD_FLAG);

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');

ReactDOM.createRoot(root).render(
  <AuthProvider>
    <AppRouter />
  </AuthProvider>,
);
