import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

// iOS Safari no aplica :active (ni :hover) al tocar un elemento a menos que
// exista ALGÚN listener de touch en la página - sin este truco clásico, todo
// el feedback de "press" (scale al soltar botones/pills/cards) definido en
// CSS con :active simplemente no se ve en iPhone, aunque funcione perfecto
// en desktop. No hace nada más que "despertar" ese comportamiento.
document.addEventListener('touchstart', () => {}, { passive: true })

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
