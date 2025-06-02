<template>
  <div class="topology-page">
    <el-card>
      <template #header>
        <div class="page-header">
          <h3>网络拓扑</h3>
          <div class="header-actions">
            <el-button type="primary" @click="exportTopology">
              <el-icon><Download /></el-icon>
              导出拓扑
            </el-button>
          </div>
        </div>
      </template>
      
      <TopologyGraph />
    </el-card>
  </div>
</template>

<script setup>
import TopologyGraph from '../../components/TopologyGraph/TopologyGraph.vue'
import { ElMessage } from 'element-plus'

// 导出拓扑
const exportTopology = () => {
  ElMessage.info('导出功能开发中...')
}
</script>

<style scoped>
.topology-page {
  height: calc(100vh - 140px);
}

.topology-page .el-card {
  height: 100%;
}

.topology-page .el-card :deep(.el-card__body) {
  height: calc(100% - 60px);
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h3 {
  margin: 0;
  color: #303133;
}
</style>