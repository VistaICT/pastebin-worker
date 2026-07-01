import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const debugAssets = mode === 'debug' || process.env.LOCKBOX_DEBUG_ASSETS === '1';

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      cssCodeSplit: false,
      minify: debugAssets ? false : 'esbuild',
      sourcemap: debugAssets,
      cssMinify: debugAssets ? false : 'esbuild',
    },
  };
});
