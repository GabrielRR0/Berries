import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import '@fontsource-variable/plus-jakarta-sans'
import './style.css'

// iOS Safari no aplica :active (ni :hover) al tocar un elemento a menos que
// exista ALGÚN listener de touch en la página - sin este truco clásico, todo
// el feedback de "press" (scale al soltar botones/pills/cards) definido en
// CSS con :active simplemente no se ve en iPhone, aunque funcione perfecto
// en desktop. No hace nada más que "despertar" ese comportamiento.
document.addEventListener('touchstart', () => {}, { passive: true })

// La restauracion nativa de scroll del navegador (su default es 'auto') corre
// en paralelo a la propia de router/index.ts + usePageScroll.ts y las dos
// terminan peleandose por el mismo scrollY - el navegador suele reaplicar la
// suya recien cuando juzga la pagina "estable", que puede caer justo despues
// de que el contenido async (fetch de la pantalla) termino de cambiar el alto
// del documento (bug real reportado por el usuario: salto brusco ~1s despues
// de cambiar de pagina). Apagarla deja un solo responsable del scroll.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual'
}

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
