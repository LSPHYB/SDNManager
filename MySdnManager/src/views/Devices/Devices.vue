<template>
  <div class="devices-page">
    <el-card>
      <template #header>
        <div class="page-header">
          <h3>设备管理</h3>
          <div class="header-actions">
            <el-input
              v-model="searchText"
              placeholder="搜索设备..."
              style="width: 200px; margin-right: 10px;"
              clearable
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-button type="primary" @click="refreshDevices" :loading="loading">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <!-- 设备统计 -->
      <div class="device-stats">
        <el-row :gutter="20">
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-number">{{ deviceStats.total }}</div>
              <div class="stat-label">总设备数</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-number">{{ deviceStats.connected }}</div>
              <div class="stat-label">在线设备</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-number">{{ deviceStats.switches }}</div>
              <div class="stat-label">交换机</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-number">{{ deviceStats.hosts }}</div>
              <div class="stat-label">主机</div>
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 设备列表 -->
      <el-table
        :data="filteredDevices"
        v-loading="loading"
        style="width: 100%"
        @row-click="showDeviceDetail"
      >
        <el-table-column prop="id" label="设备ID" width="200" />
        <el-table-column prop="name" label="设备名称" width="150" />
        <el-table-column label="设备类型" width="120">
          <template #default="scope">
            <el-tag :type="getDeviceTypeColor(scope.row.type)">
              {{ getDeviceTypeLabel(scope.row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="连接状态" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'connected' ? 'success' : 'danger'">
              {{ scope.row.status === 'connected' ? '已连接' : '未连接' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="connectors.length" label="端口数量" width="100" />
        <el-table-column label="最后更新" width="180">
          <template #default="scope">
            {{ formatTime(scope.row.lastUpdate) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="scope">
            <el-button link @click.stop="showDeviceDetail(scope.row)">
              详情
            </el-button>
            <el-button link @click.stop="showFlowTables(scope.row)">
              流表
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 设备详情对话框 -->
    <el-dialog
      v-model="showDetailDialog"
      :title="selectedDevice?.name || '设备详情'"
      width="800px"
    >
      <div v-if="selectedDevice" class="device-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="设备ID">
            {{ selectedDevice.id }}
          </el-descriptions-item>
          <el-descriptions-item label="设备名称">
            {{ selectedDevice.name }}
          </el-descriptions-item>
          <el-descriptions-item label="设备类型">
            <el-tag :type="getDeviceTypeColor(selectedDevice.type)">
              {{ getDeviceTypeLabel(selectedDevice.type) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="连接状态">
            <el-tag :type="selectedDevice.status === 'connected' ? 'success' : 'danger'">
              {{ selectedDevice.status === 'connected' ? '已连接' : '未连接' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="端口数量">
            {{ selectedDevice.connectors?.length || 0 }}
          </el-descriptions-item>
          <el-descriptions-item label="最后更新">
            {{ formatTime(selectedDevice.lastUpdate) }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 端口信息 -->
        <div v-if="selectedDevice.connectors && selectedDevice.connectors.length > 0" class="device-ports">
          <h4>端口信息</h4>
          <el-table :data="selectedDevice.connectors" size="small">
            <el-table-column prop="id" label="端口ID" />
            <el-table-column prop="name" label="端口名称" />
            <el-table-column label="状态">
              <template #default="scope">
                <el-tag size="small" :type="scope.row.state === 'LIVE' ? 'success' : 'danger'">
                  {{ scope.row.state || '未知' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="currentSpeed" label="当前速度" />
            <el-table-column prop="maximumSpeed" label="最大速度" />
          </el-table>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { deviceService } from '../../services/device.js'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'

const router = useRouter()

// 响应式数据
const devices = ref([])
const loading = ref(false)
const searchText = ref('')
const showDetailDialog = ref(false)
const selectedDevice = ref(null)

// 计算属性
const filteredDevices = computed(() => {
  if (!searchText.value) return devices.value
  return devices.value.filter(device => 
    device.id.toLowerCase().includes(searchText.value.toLowerCase()) ||
    device.name.toLowerCase().includes(searchText.value.toLowerCase())
  )
})

const deviceStats = computed(() => {
  const total = devices.value.length
  const connected = devices.value.filter(d => d.status === 'connected').length
  const switches = devices.value.filter(d => d.type === 'switch').length
  const hosts = devices.value.filter(d => d.type === 'host').length
  
  return { total, connected, switches, hosts }
})

// 加载设备列表
const loadDevices = async () => {
  loading.value = true
  try {
    const deviceList = await deviceService.getDevices()
    devices.value = deviceList.map(device => ({
      ...device,
      lastUpdate: new Date().toISOString()
    }))
    
    if (devices.value.length === 0) {
      // 使用模拟数据
      devices.value = [
        {
          id: 'openflow:1',
          name: 'Switch-1',
          type: 'switch',
          status: 'connected',
          connectors: [
            { id: '1', name: 'eth0', state: 'LIVE', currentSpeed: '1000', maximumSpeed: '1000' },
            { id: '2', name: 'eth1', state: 'LIVE', currentSpeed: '1000', maximumSpeed: '1000' }
          ],
          lastUpdate: new Date().toISOString()
        },
        {
          id: 'openflow:2',
          name: 'Switch-2',
          type: 'switch',
          status: 'connected',
          connectors: [
            { id: '1', name: 'eth0', state: 'LIVE', currentSpeed: '1000', maximumSpeed: '1000' }
          ],
          lastUpdate: new Date().toISOString()
        },
        {
          id: 'host:1',
          name: 'Host-1',
          type: 'host',
          status: 'connected',
          connectors: [],
          lastUpdate: new Date().toISOString()
        }
      ]
    }
    
    ElMessage.success(`加载完成：${devices.value.length}个设备`)
  } catch (error) {
    console.error('加载设备失败:', error)
    ElMessage.error('加载设备失败：' + error.message)
  } finally {
    loading.value = false
  }
}

// 刷新设备列表
const refreshDevices = () => {
  loadDevices()
}

// 显示设备详情
const showDeviceDetail = (device) => {
  selectedDevice.value = device
  showDetailDialog.value = true
}

// 显示流表
const showFlowTables = (device) => {
  router.push({ name: 'FlowTables', query: { nodeId: device.id } })
}

// 获取设备类型颜色
const getDeviceTypeColor = (type) => {
  const colors = {
    switch: 'primary',
    host: 'success',
    controller: 'warning',
    unknown: 'info'
  }
  return colors[type] || colors.unknown
}

// 获取设备类型标签
const getDeviceTypeLabel = (type) => {
  const labels = {
    switch: '交换机',
    host: '主机',
    controller: '控制器',
    unknown: '未知'
  }
  return labels[type] || labels.unknown
}

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return '-'
  return new Date(timeStr).toLocaleString('zh-CN')
}

// 组件挂载
onMounted(() => {
  loadDevices()
})
</script>

<style scoped>
.devices-page {
  height: calc(100vh - 140px);
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

.header-actions {
  display: flex;
  align-items: center;
}

.device-stats {
  margin-bottom: 20px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 4px;
}

.stat-item {
  text-align: center;
}

.stat-number {
  font-size: 24px;
  font-weight: bold;
  color: #409EFF;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.device-detail {
  padding: 20px;
}

.device-ports {
  margin-top: 20px;
}

.device-ports h4 {
  margin-bottom: 15px;
  color: #303133;
}

.el-table {
  cursor: pointer;
}

.el-table :deep(.el-table__row:hover) {
  background-color: #f5f7fa;
}
</style>