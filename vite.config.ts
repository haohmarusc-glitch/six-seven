import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Replit injeta PORT em produção/preview; localmente cai no padrão do Vite
// (5173) se a env var não estiver setada, pra não travar o dev fora do Replit.
const port = process.env.PORT ? Number(process.env.PORT) : 5173

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port,
    // A câmera (getUserMedia) só funciona em contexto seguro -- https ou
    // localhost. No Replit isso já vem com https por padrão.
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port,
    allowedHosts: true,
  },
})
