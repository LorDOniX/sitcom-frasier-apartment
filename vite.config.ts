import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // three.js do vlastního souboru: mění se jen při aktualizaci knihovny, prohlížeč ho má v cache
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
});
