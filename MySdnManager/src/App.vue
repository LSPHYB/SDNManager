<template>
  <div id="app">
    <MainLayout />
  </div>
</template>

<script setup>
import MainLayout from './components/Layout/MainLayout.vue'
</script>

<style>
#app {
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
  margin: 0;
  padding: 0;
  height: 100vh;
  width: 100%; /* 添加宽度100% */
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
