import { encodeBase64Url } from '@lockbox/types/base64';

const worker = new Worker(new URL('../workers/secret-crypto-worker.ts', import.meta.url), { type: 'module' });

type EncryptResult = {
  ciphertext: string;
  ivBase64: string;
};

type PendingEntry<T> = {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const pending = new Map<string, {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}>();

worker.onmessage = (event: MessageEvent<{
  requestId: string;
  ok: boolean;
  ciphertext?: string;
  ivBase64?: string;
  content?: string;
  error?: string;
}>) => {
  const message = event.data;
  const entry = pending.get(message.requestId);
  if (!entry) return;

  pending.delete(message.requestId);
  if (!message.ok) {
    entry.reject(new Error(message.error || 'Crypto operation failed'));
    return;
  }

  if (typeof message.content === 'string') {
    entry.resolve(message.content);
    return;
  }

  entry.resolve({
    ciphertext: message.ciphertext ?? '',
    ivBase64: message.ivBase64 ?? '',
  } satisfies EncryptResult);
};

export async function createFragmentKey(): Promise<string> {
  const key = crypto.getRandomValues(new Uint8Array(32));
  return encodeBase64Url(key);
}

export async function encryptSecretText(content: string, keyBase64Url: string): Promise<EncryptResult> {
  const requestId = crypto.randomUUID();
  const promise = createPendingPromise<EncryptResult>(requestId);
  worker.postMessage({ type: 'encrypt-text', requestId, content, keyBase64Url });
  return promise;
}

export async function decryptSecretText(ciphertext: string, ivBase64: string, keyBase64Url: string): Promise<string> {
  const requestId = crypto.randomUUID();
  const promise = createPendingPromise<string>(requestId);
  worker.postMessage({ type: 'decrypt-text', requestId, ciphertext, ivBase64, keyBase64Url });
  return promise;
}

export function readFragmentKey(): string | null {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  return params.get('k');
}

export function buildFragmentHash(keyBase64Url: string): string {
  return `#k=${encodeURIComponent(keyBase64Url)}`;
}

function createPendingPromise<T>(requestId: string, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const onAbort = () => {
      pending.delete(requestId);
      reject(createAbortError());
    };

    pending.set(requestId, {
      resolve: (value) => {
        signal?.removeEventListener('abort', onAbort);
        (resolve as PendingEntry<T>['resolve'] as (value: unknown) => void)(value);
      },
      reject: (reason) => {
        signal?.removeEventListener('abort', onAbort);
        reject(reason);
      },
    });

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function createAbortError() {
  return new DOMException('Transfer cancelled', 'AbortError');
}

