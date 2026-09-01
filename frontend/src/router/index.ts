import { createRouter, createWebHistory } from 'vue-router'
import { updatePageTransitionName } from '../composables/navigation/usePageTransition'
import { useAuthStore } from '../stores/auth.store'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    // Pedido explicito del usuario: crear/editar una meta es una tarea enfocada
    // de una sola pantalla (con su propio boton de "atras") - la barra flotante
    // de navegacion (Inicio/Movimientos/Menu) no aporta nada ahi y solo resta
    // espacio vertical util en el telefono.
    hideTabBar?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../components/auth/LoginForm.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../components/auth/RegisterWizard.vue'),
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../components/dashboard/DashboardMain.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/calculadora',
      name: 'calculadora',
      component: () => import('../components/calculator/CalculatorMain.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/movimientos',
      name: 'movimientos',
      component: () => import('../components/transactions/TransactionsMain.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/cuentas',
      name: 'cuentas',
      component: () => import('../components/wallets/WalletsMain.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/ajustes',
      name: 'ajustes',
      component: () => import('../components/dashboard/SettingsMenuMain.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/deudas',
      name: 'deudas',
      component: () => import('../components/debts/DebtsMain.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/analitica',
      name: 'analitica',
      component: () => import('../components/analytics/AnalyticsMain.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/metas',
      name: 'metas',
      component: () => import('../components/goals/GoalsMain.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/metas/nueva',
      name: 'metas-nueva',
      component: () => import('../components/goals/CreateGoalView.vue'),
      meta: { requiresAuth: true, hideTabBar: true },
    },
    {
      path: '/metas/:id/editar',
      name: 'metas-editar',
      component: () => import('../components/goals/EditGoalView.vue'),
      meta: { requiresAuth: true, hideTabBar: true },
    },
    {
      path: '/categorias',
      name: 'categorias',
      component: () => import('../components/categories/CategoriesMain.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to, from) => {
  updatePageTransitionName(to, from)

  const authStore = useAuthStore()
  const isAuthOnlyRoute = to.name === 'login' || to.name === 'register'

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login' }
  }

  if (isAuthOnlyRoute && authStore.isAuthenticated) {
    return { name: 'dashboard' }
  }

  return true
})

// Reset del scroll ANTES de que cambie la ruta, no despues (ver
// .route-transition-viewport en style.css: la pagina que entra y la que sale
// quedan position:absolute superpuestas mientras dura el slide, asi que el
// scrollY de la pagina anterior queda "pegado" durante la transicion - se
// alcanzaba a ver la parte de abajo de la pagina nueva por un instante, y
// recien al terminar la transicion el navegador lo recortaba de golpe al
// tope). Haciendolo aca, en vez de con la opcion scrollBehavior (que corre
// despues de pintado el DOM nuevo), el salto queda resuelto antes de que se
// pinte el siguiente frame.
router.beforeEach((to, from) => {
  if (to.path !== from.path) {
    window.scrollTo(0, 0)
  }
  return true
})

export default router
