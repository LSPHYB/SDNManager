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
        <div v-if="selectedDevice" class="device-ports">
          <h4>端口信息</h4>
          <el-table :data="devicePorts" size="small"
            :key="selectedDevice?.id"
          >
            <el-table-column prop="id" label="端口ID" />
            <el-table-column prop="name" label="端口名称" />
            <el-table-column label="状态">
              <template #default="scope">
                <el-tag size="small" :type="scope.row.state === 'LIVE' ? 'success' : 'danger'">
                  {{ scope.row.state || '未知' }}
                </el-tag>
              </template>
            </el-table-column>
            <!-- 主机特有信息 -->
            <el-table-column v-if="selectedDevice.type === 'host'" prop="ip" label="IP地址">
              <template #default="scope">
                {{ scope.row.ip || '未知' }}
              </template>
            </el-table-column>
            <el-table-column v-if="selectedDevice.type === 'host'" prop="mac" label="MAC地址">
              <template #default="scope">
                {{ scope.row.mac || '未知' }}
              </template>
            </el-table-column>
            <!-- 交换机特有信息 -->
            <el-table-column v-if="selectedDevice.type === 'switch'" prop="currentSpeed" label="当前速度" />
            <el-table-column v-if="selectedDevice.type === 'switch'" prop="maximumSpeed" label="最大速度" />
          </el-table>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { deviceService } from '../../services/device.js'
import { topologyService } from '../../services/topology.js'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'

const router = useRouter()

// 响应式数据
const devices = ref([])
const loading = ref(false)
const searchText = ref('')
const showDetailDialog = ref(false)
const selectedDevice = ref(null)
const devicePorts = ref([]) // 新增：存储设备端口信息
const portLoading = ref(false)

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

// 从设备ID中提取MAC地址的函数
const extractMacFromHostId = (hostId) => {
  if (!hostId || !hostId.includes('host:')) return '未知'
  
  // 从host:xx:xx:xx:xx:xx:xx格式中提取MAC地址
  const parts = hostId.split(':')
  if (parts.length >= 7) {
    // 提取MAC地址部分 (host:后面的6个部分)
    const macParts = parts.slice(1, 7)
    return macParts.join(':')
  }
  
  return '未知'
}

// 从拓扑数据中获取主机IP地址的函数
const getHostIpFromTopology = async (hostId) => {
  try {
    const topologyNodes = await topologyService.getTopologyNodes()
    const hostNode = topologyNodes.find(node => node.id === hostId)
    
    if (hostNode) {
      // 检查host-tracker-service:addresses字段
      if (hostNode['host-tracker-service:addresses'] && 
          Array.isArray(hostNode['host-tracker-service:addresses']) && 
          hostNode['host-tracker-service:addresses'].length > 0) {
        const addresses = hostNode['host-tracker-service:addresses']
        for (const addr of addresses) {
          if (addr.ip) return addr.ip
          if (addr['ip-address']) return addr['ip-address']
        }
      }
      
      // 检查其他可能的IP字段
      if (hostNode.ip) return hostNode.ip
      if (hostNode.addresses && Array.isArray(hostNode.addresses)) {
        for (const addr of hostNode.addresses) {
          if (addr.ip) return addr.ip
        }
      }
    }
  } catch (error) {
    console.error('从拓扑获取主机IP失败:', error)
  }
  
  return '未知'
}

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
          id: 'host:aa:bb:cc:dd:ee:ff',
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

// 显示设备详情 - 修复版本
// 添加组件卸载时的清理
let isComponentMounted = ref(true)

const showDeviceDetail = async (device) => {
  if (!isComponentMounted.value) return
  
  try {
    selectedDevice.value = device
    showDetailDialog.value = true
    portLoading.value = true
    
    const ports = await formatDevicePorts(device)
    if (isComponentMounted.value) {
      devicePorts.value = ports
    }
  } catch (error) {
    if (isComponentMounted.value) {
      console.error('加载设备详情失败:', error)
      ElMessage.error('加载设备详情失败')
      devicePorts.value = []
    }
  }
}

onUnmounted(() => {
  isComponentMounted.value = false
})

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

// 处理端口信息
const formatDevicePorts = async (device) => {
  if (!device) return []
  
  // 如果是主机设备，特殊处理
  if (device.type === 'host') {
    const ports = []
    
    // 从设备ID中提取MAC地址
    const macAddress = extractMacFromHostId(device.id)
    
    // 从拓扑数据中获取IP地址
    const ipAddress = await getHostIpFromTopology(device.id)
    
    // 处理主机连接点
    if (device.connectors && Array.isArray(device.connectors)) {
      device.connectors.forEach(connector => {
        ports.push({
          ...connector,
          mac: macAddress,
          ip: ipAddress
        })
      })
      return ports
    }
    
    // 处理attachment-points格式
    if (device['host-tracker-service:attachment-points'] && 
        Array.isArray(device['host-tracker-service:attachment-points'])) {
      device['host-tracker-service:attachment-points'].forEach(ap => {
        ports.push({
          id: ap['tp-id'] || '',
          name: formatPortName(ap['tp-id'] || ''),
          state: 'LIVE',
          currentSpeed: '未知',
          maximumSpeed: '未知',
          mac: macAddress,
          ip: ipAddress
        })
      })
      return ports
    }
    
    // 处理addresses格式
    if (device['host-tracker-service:addresses'] && 
        Array.isArray(device['host-tracker-service:addresses'])) {
      device['host-tracker-service:addresses'].forEach((addr, index) => {
        ports.push({
          id: `addr-${index}`,
          name: addr.ip || addr.mac || `地址-${index}`,
          state: 'LIVE',
          currentSpeed: '未知',
          maximumSpeed: '未知',
          ip: addr.ip || ipAddress,
          mac: addr.mac || macAddress
        })
      })
      return ports
    }
    
    // 如果没有其他连接点信息，创建一个默认的端口显示MAC和IP
    if (ports.length === 0) {
      ports.push({
        id: 'default',
        name: '主机接口',
        state: 'LIVE',
        currentSpeed: '未知',
        maximumSpeed: '未知',
        mac: macAddress,
        ip: ipAddress
      })
    }
    
    return ports
  }
  
  // 处理node-connector格式 (交换机设备)
  if (device.connectors && Array.isArray(device.connectors)) {
    return device.connectors.map(port => ({
      id: port.id || port['tp-id'] || '',
      name: formatPortName(port.id || port['tp-id'] || ''),
      state: getPortState(port),
      currentSpeed: getPortSpeed(port, 'current'),
      maximumSpeed: getPortSpeed(port, 'maximum')
    }))
  }
  
  // 处理termination-point格式
  if (device['termination-point'] && Array.isArray(device['termination-point'])) {
    return device['termination-point'].map(tp => ({
      id: tp['tp-id'] || '',
      name: formatPortName(tp['tp-id'] || ''),
      state: getPortState(tp),
      currentSpeed: getPortSpeed(tp, 'current'),
      maximumSpeed: getPortSpeed(tp, 'maximum')
    }))
  }
  
  return []
}

// 格式化端口名称
const formatPortName = (portId) => {
  if (!portId) return '未知'
  
  // 提取端口号部分
  const parts = portId.split(':')
  if (parts.length > 1) {
    return `端口 ${parts[parts.length-1]}`
  }
  
  return portId
}

// 获取端口状态
const getPortState = (port) => {
  // 检查flow-node-inventory:state字段
  if (port['flow-node-inventory:state']) {
    if (port['flow-node-inventory:state']['link-down'] === false) {
      return 'LIVE'
    }
    return 'DOWN'
  }
  
  // 检查state字段
  if (port.state) {
    return port.state
  }
  
  return '未知'
}

// 获取端口速度
const getPortSpeed = (port, type) => {
  if (type === 'current' && port['flow-node-inventory:current-speed']) {
    return `${port['flow-node-inventory:current-speed']} Mbps`
  }
  
  if (type === 'maximum' && port['flow-node-inventory:maximum-speed']) {
    return `${port['flow-node-inventory:maximum-speed']} Mbps`
  }
  
  if (type === 'current' && port.currentSpeed) {
    return `${port.currentSpeed} Mbps`
  }
  
  if (type === 'maximum' && port.maximumSpeed) {
    return `${port.maximumSpeed} Mbps`
  }
  
  return '未知'
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

