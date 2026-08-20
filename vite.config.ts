import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Substitui process.env.API_KEY (usado na análise de IA, opcional) por um
  // valor fixo no bundle, evitando "process is not defined" no navegador.
  // Vazio por padrão; pode ser injetado no build (ARG/ENV API_KEY no Dockerfile).
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
});