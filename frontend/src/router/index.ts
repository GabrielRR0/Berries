import { createRouter, createWebHistory } from 'vue-router'
import { updatePageTransitionName } from '../composables/navigation/usePageTransition'
import { hasScrollPosition, restoreScrollPosition, saveScrollPosition } from '../composables/navigation/usePageScroll'
import { useAuthStore } from '../stores/auth.store'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    // Pedido explicito del usuario: crear/editar una meta es una tarea enfocada
    // de una sola pantalla (con su propio boton de "atras") - la barra flotante
    // de navegacion (Inicio/Movimientos/Menu) no aporta nada ahi y solo resta
    // espacio vertical util en el telefono.
    hideTabBar?: boolean
    // Fuente unica de verdad del orden horizontal de las secciones principales
    // - SOLO las de la barra flotante (Inicio, Movimientos, Cuentas, Menu): son
    // las unicas entre las que se desliza con el dedo (SectionPager.vue). Una
    // pantalla sin order (Metas, Deudas, Analisis, Categorias...) es una
    // pantalla suelta: deslizar en ella vuelve a la pagina anterior, ver
    // composables/navigation/useLooseRouteSwipe.ts. Agregar una vista nueva a
    // la barra tiene que ser modular, sin tocar 3 archivos a mano. Tanto
    // usePageTransition.ts (direccion del slide) como BottomTabBar.vue (orden
    // de los tabs) leen este mismo campo - antes eran dos arrays hardcodeados
    // e independientes que ya se habian desincronizado entre si.
    order?: number
    // Si esta presente, la ruta aparece en la barra flotante inferior. Ausente
    // en las pantallas de tarea enfocada (calculadora, captura, crear/editar
    // meta) y en las secciones secundarias que hoy solo se llegan via accesos
    // rapidos del dashboard.
    tabBar?: { label: string; icon: 'home' | 'movimientos' | 'cuentas' | 'menu' }
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
      meta: { requiresAuth: true, order: 0, tabBar: { label: 'Inicio', icon: 'home' } },
    },
    {
      path: '/calculadora',
      name: 'calculadora',
      component: () => import('../components/calculator/CalculatorMain.vue'),
      meta: { requiresAuth: true, hideTabBar: true },
    },
    {
      path: '/movimientos',
      name: 'movimientos',
      component: () => import('../components/transactions/TransactionsMain.vue'),
      meta: { requiresAuth: true, order: 1, tabBar: { label: 'Movimientos', icon: 'movimientos' } },
    },
    {
      path: '/movimientos/captura',
      name: 'movimientos-captura',
      component: () => import('../components/screenshotScan/BulkCaptureView.vue'),
      meta: { requiresAuth: true, hideTabBar: true },
    },
    {
      path: '/cuentas',
      name: 'cuentas',
      component: () => import('../components/wallets/WalletsMain.vue'),
      meta: { requiresAuth: true, order: 2, tabBar: { label: 'Cuentas', icon: 'cuentas' } },
    },
    {
      path: '/ajustes',
      name: 'ajustes',
      component: () => import('../components/dashboard/SettingsMenuMain.vue'),
      meta: { requiresAuth: true, order: 3, tabBar: { label: 'Menú', icon: 'menu' } },
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
      path: '/tasas',
      name: 'tasas',
      component: () => import('../components/rates/RatesMain.vue'),
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
    {
      path: '/pendientes',
      name: 'pendientes',
      component: () => import('../components/offline/PendingSyncMain.vue'),
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

// Guarda/restaura el scroll por ruta (pedido explicito del usuario: volver a
// Movimientos despues de haberse quedado leyendo mas abajo tiene que
// mantener ese lugar, no arrancar siempre desde arriba). El reset a 0 ANTES
// de que cambie la ruta (en vez de con la opcion scrollBehavior, que corre
// despues de pintado el DOM nuevo) sigue aplicando igual que antes para una
// ruta nueva que nunca se visito - ver .route-transition-viewport en
// style.css: la pagina que entra y la que sale quedan position:absolute
// superpuestas mientras dura el slide, asi que sin este reset se alcanzaba a
// ver la parte de abajo de la pagina nueva por un instante. Para una ruta YA
// visitada, restoreScrollPosition (afterEach) se encarga de dejarla donde el
// usuario la dejo - ver usePageScroll.ts para por que hace falta reintentar
// mientras el contenido async todavia esta cambiando de alto (la causa real
// del "salto brusco un segundo despues" reportado por el usuario).
router.beforeEach((to, from) => {
  if (to.path !== from.path) {
    saveScrollPosition(from.fullPath)
    if (!hasScrollPosition(to.fullPath)) {
      window.scrollTo(0, 0)
    }
  }
  return true
})

router.afterEach((to) => {
  restoreScrollPosition(to.fullPath)
})

export default router
