import { createRouter, createWebHistory } from 'vue-router'
import { authService } from '../services/auth.js'
import Login from '../views/Login/Login.vue'
import Dashboard from '../views/Dashboard/Dashboard.vue'
import Topology from '../views/Topology/Topology.vue'
import Devices from '../views/Devices/Devices.vue'
import FlowTables from '../views/FlowTables/FlowTables.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { title: '登录', requiresAuth: false }
  },
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { title: '仪表板', requiresAuth: true }
  },
  {
    path: '/topology',
    name: 'Topology',
    component: Topology,
    meta: { title: '网络拓扑', requiresAuth: true }
  },
  {
    path: '/devices',
    name: 'Devices',
    component: Devices,
    meta: { title: '设备管理', requiresAuth: true }
  },
  {
    path: '/flows',
    name: 'FlowTables',
    component: FlowTables,
    meta: { title: '流表管理', requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const isAuthenticated = authService.isAuthenticated()
  
  // 如果访问登录页面且已登录，重定向到仪表板
  if (to.path === '/login' && isAuthenticated) {
    next('/dashboard')
    return
  }
  
  // 如果需要认证但未登录，重定向到登录页面
  if (to.meta.requiresAuth !== false && !isAuthenticated) {
    next('/login')
    return
  }
  
  next()
})

export default router