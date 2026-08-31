import { createRouter, createWebHistory } from 'vue-router'
import { updatePageTransitionName } from '../composables/navigation/usePageTransition'
import { useAuthStore } from '../stores/auth.store'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
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
      meta: { requiresAuth: true },
    },
    {
      path: '/metas/:id/editar',
      name: 'metas-editar',
      component: () => import('../components/goals/EditGoalView.vue'),
      meta: { requiresAuth: true },
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

export default router
