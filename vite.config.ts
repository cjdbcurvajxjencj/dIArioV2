import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  // Rimosso il plugin 'react()' per evitare la dipendenza da '@vitejs/plugin-react'.
  // Vite usa esbuild internamente, che può gestire JSX.
  // Esplicitiamo la configurazione per assicurarci che la trasformazione JSX avvenga.
  esbuild: {
    jsx: 'automatic',
  },
  build: {
    rollupOptions: {
      // Indica a Vite di non includere i moduli di Capacitor e pako nel bundle finale.
      // Questi moduli vengono forniti dall'ambiente al runtime (da Capacitor o dall'importmap).
      external: [
        /^@capacitor\/.*/,
        'pako',
      ],
    },
  },
});