<template>
  <div id="app">
    <MainLayout v-if="isAuthenticated" />
    <router-view v-else />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import MainLayout from './components/Layout/MainLayout.vue'
import { authService } from './services/auth.js'

const route = useRoute()
const isAuthenticated = ref(false)

// 检查认证状态
const checkAuth = () => {
  isAuthenticated.value = authService.isAuthenticated()
}

// 监听路由变化，更新认证状态
watch(() => route.path, () => {
  checkAuth()
})

// 组件挂载时检查认证状态
onMounted(() => {
  checkAuth()
})
</script>

<style>
#app {
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
  margin: 0;
  padding: 0;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  height: 100vh;
}

html {
  height: 100%;
  overflow: hidden;
}

/* 确保Element Plus组件正常显示 */
.el-container {
  position: relative;
  height: 100%;
}

.el-main {
  position: relative;
  background-color: #f5f5f5;
}

/* 修复可能的层级问题 */
.el-loading-mask {
  z-index: 9999 !important;
}

.el-message {
  z-index: 10000 !important;
}

.el-dialog {
  z-index: 10001 !important;
}

.el-drawer {
  z-index: 10002 !important;
}
</style>
