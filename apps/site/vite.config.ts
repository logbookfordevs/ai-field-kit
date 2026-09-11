import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import mdx from '@mdx-js/rollup';
import { markdownOptions } from './src/docs/markdown-options.ts';
import { docsExportsPlugin } from './scripts/docs-exports.ts';

export default defineConfig({
  plugins: [mdx(markdownOptions), react(), tailwindcss(), docsExportsPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
