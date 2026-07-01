import { decodeBase64UrlToBytes } from '@lockbox/types/base64';

type EncryptTextMessage = {
  type: 'encrypt-text';
  requestId: string;
  content: string;
  keyBase64Url: string;
};

type DecryptTextMessage = {
  type: 'decrypt-text';
  requestId: string;
  ciphertext: string;
  ivBase64: string;
  keyBase64Url: string;
};

type WorkerMessage = EncryptTextMessage | DecryptTextMessage;

type WorkerResponse = {
  requestId: string;
  ok: true;
  ciphertext?: string;
  ivBase64?: string;
  content?: string;
} | {
  requestId: string;
  ok: false;
  error: string;
};

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'encrypt-text': {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await importAesKey(message.keyBase64Url);
        const ciphertext = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          new TextEncoder().encode(message.content),
        );

        postMessage({
          requestId: message.requestId,
          ok: true,
          ciphertext: encodeBase64(new Uint8Array(ciphertext)),
          ivBase64: encodeBase64(iv),
        } satisfies WorkerResponse);
        return;
      }

      case 'decrypt-text': {
        const key = await importAesKey(message.keyBase64Url);
        const plaintext = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: toArrayBuffer(decodeBase64(message.ivBase64)) },
          key,
          toArrayBuffer(decodeBase64(message.ciphertext)),
        );

        postMessage({
          requestId: message.requestId,
          ok: true,
          content: new TextDecoder().decode(plaintext),
        } satisfies WorkerResponse);
        return;
      }
    }
  } catch (error) {
    postMessage({
      requestId: message.requestId,
      ok: false,
      error: error instanceof Error ? error.message : 'Crypto operation failed',
    } satisfies WorkerResponse);
  }
};

async function importAesKey(keyBase64Url: string) {
  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(decodeBase64UrlToBytes(keyBase64Url)),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export {};