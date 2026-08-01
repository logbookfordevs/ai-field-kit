import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss(), installerAssets()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});

function installerAssets() {
  return {
    name: 'installer-assets',
    closeBundle() {
      const siteDir = dirname(fileURLToPath(import.meta.url));
      const outputDir = resolve(siteDir, 'dist');
      const scriptsDir = resolve(siteDir, '../../scripts');
      mkdirSync(outputDir, { recursive: true });
      copyFileSync(resolve(scriptsDir, 'install.sh'), resolve(outputDir, 'install.sh'));
      copyFileSync(resolve(scriptsDir, 'install.ps1'), resolve(outputDir, 'install.ps1'));
    },
  };
}
