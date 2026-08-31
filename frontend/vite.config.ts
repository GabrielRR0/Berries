/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      // Puerto 8002 (no 8000) a propósito: s-rank ya usa 8000 y tayuya-check usa 8001
      // por convención del portafolio — cada proyecto hermano necesita su propio
      // puerto para poder correr varios en simultáneo sin que el proxy de uno le
      // pegue al backend de otro (así se detectó este mismo choque real).
      '/api': 'http://localhost:8002',
    },
    // Prueba desde el telefono via tunel publico (pedido explicito del
    // usuario - su telefono no esta en la misma red WiFi). Vite bloquea por
    // defecto cualquier Host header que no sea localhost/IP (proteccion anti
    // DNS-rebinding) - sin esto, el navegador del telefono recibe "Blocked
    // request" al entrar por la URL del tunel. Acotado a estos dominios (no
    // `true`, que permitiria cualquier host) porque es temporal y solo para
    // esta prueba. .loca.lt = localtunnel (resultó poco confiable, se cae
    // seguido); .trycloudflare.com = cloudflared quick tunnel (el que se usa
    // ahora, mucho mas estable).
    allowedHosts: ['.loca.lt', '.trycloudflare.com'],
  },
  test: {
    environment: 'jsdom',
    // El pool 'threads' (default de Vitest 4) cuelga arrancando workers en
    // este entorno de desarrollo restringido (timeout esperando respuesta) -
    // 'forks' si arranca limpio aca. Revisar si a futuro se puede volver al
    // default en otra maquina/CI.
    pool: 'forks',
    // Con la suite ya en ~15 archivos, correr varios workers 'forks' en
    // paralelo tambien empieza a timentear ("Timeout waiting for worker to
    // respond") en este entorno restringido. Ejecutar los archivos en serie
    // es mas lento pero confiable - revisar si a futuro se puede sacar esto
    // en otra maquina/CI con mas recursos.
    fileParallelism: false,
  },
})
