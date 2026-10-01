import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // Base tương đối để deploy được lên GitHub Pages ở sub-path
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      emptyOutDir: false,
      target: 'esnext',
      minify: 'esbuild',
      cssCodeSplit: true,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html')
        },
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('recharts') || id.includes('d3-')) return 'recharts';
              if (id.includes('lucide')) return 'icons';
              if (id.includes('react/') || id.includes('react-dom/') || id.includes('scheduler')) return 'react-vendor';
              if (id.includes('@supabase')) return 'supabase';
              return 'vendor'; // all other deps
            }
          }
        }
      }
    },
    optimizeDeps: {
      entries: ['index.html']
    }
  };
});
