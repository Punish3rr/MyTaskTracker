import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist-electron',
    lib: {
      entry: {
        main: resolve(__dirname, 'main.ts'),
        preload: resolve(__dirname, 'preload.ts'),
      },
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['electron'],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});

