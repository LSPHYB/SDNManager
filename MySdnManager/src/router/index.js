import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard/Dashboard.vue'
import Topology from '../views/Topology/Topology.vue'
import Devices from '../views/Devices/Devices.vue'
import FlowTables from '../views/FlowTables/FlowTables.vue'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { title: '仪表板' }
  },
  {
    path: '/topology',
    name: 'Topology',
    component: Topology,
    meta: { title: '网络拓扑' }
  },
  {
    path: '/devices',
    name: 'Devices',
    component: Devices,
    meta: { title: '设备管理' }
  },
  {
    path: '/flows',
    name: 'FlowTables',
    component: FlowTables,
    meta: { title: '流表管理' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router