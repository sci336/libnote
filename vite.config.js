import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
    base: '/libnote/',
    plugins: [react()],
    test: {
        environment: 'jsdom',
        exclude: ['node_modules', 'dist', 'e2e', '**/.claude/**']
    }
});
