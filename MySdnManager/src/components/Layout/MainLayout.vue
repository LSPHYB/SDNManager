<template>
  <el-container class="main-layout">
    <!-- 侧边栏 -->
    <el-aside width="250px" class="sidebar">
      <div class="logo">
        <h2>SDN Manager</h2>
      </div>
      <el-menu
        :default-active="$route.path"
        router
        class="sidebar-menu"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
      >
        <el-menu-item index="/dashboard">
          <el-icon><Odometer /></el-icon>
          <span>仪表板</span>
        </el-menu-item>
        <el-menu-item index="/topology">
          <el-icon><Share /></el-icon>
          <span>网络拓扑</span>
        </el-menu-item>
        <el-menu-item index="/devices">
          <el-icon><Monitor /></el-icon>
          <span>设备管理</span>
        </el-menu-item>
        <el-menu-item index="/flows">
          <el-icon><Connection /></el-icon>
          <span>流表管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <!-- 主内容区 -->
    <el-container>
      <!-- 顶部导航栏 -->
      <el-header class="header">
        <div class="header-left">
          <h3>{{ $route.meta.title || 'SDN网络管理系统' }}</h3>
        </div>
        <div class="header-right">
          <el-button type="primary" @click="refreshData">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
          <el-dropdown @command="handleCommand">
            <el-button link>
              <el-icon><User /></el-icon>
              {{ currentUser?.username || '管理员' }}
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout" divided>
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 主内容 -->
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { SwitchButton } from '@element-plus/icons-vue'
import { authService } from '../../services/auth.js'

const router = useRouter()
const currentUser = ref(null)

// 获取当前用户信息
onMounted(() => {
  currentUser.value = authService.getCurrentUser()
})

// 刷新数据
const refreshData = () => {
  ElMessage.success('数据刷新成功')
  window.location.reload()
}

// 处理下拉菜单命令
const handleCommand = async (command) => {
  if (command === 'logout') {
    try {
      await ElMessageBox.confirm(
        '确定要退出登录吗？',
        '退出确认',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
      
      await authService.logout()
      ElMessage.success('已退出登录')
      router.push('/login')
    } catch {
      // 用户取消退出
    }
  }
}
</script>

<style scoped>
.main-layout {
  height: 100vh;
  width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: row;
}

.sidebar {
  background-color: #304156;
  overflow: hidden;
  position: relative;
  z-index: 10;
  height: 100vh;
}

.logo {
  padding: 20px;
  text-align: center;
  border-bottom: 1px solid #434a50;
}

.logo h2 {
  margin: 0;
  font-size: 18px;
  color: #fff;
}

.sidebar-menu {
  border: none;
  height: calc(100vh - 80px);
  overflow-y: auto;
}

.header {
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  height: 60px;
  position: relative;
  z-index: 9;
  box-shadow: 0 1px 4px rgba(0,21,41,.08);
}

.header-left h3 {
  margin: 0;
  color: #303133;
  font-size: 18px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 15px;
}

.main-content {
  background-color: #f5f5f5;
  padding: 20px;
  height: calc(100vh - 60px);
  overflow-y: auto;
  position: relative;
  z-index: 1;
  flex: 1;
}
</style>