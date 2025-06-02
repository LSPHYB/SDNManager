<template>
  <div class="topology-container">
    <!-- 工具栏 -->
    <div class="topology-toolbar">
      <el-button-group>
        <el-button @click="refreshTopology" :loading="loading">
          <el-icon><Refresh /></el-icon>
          刷新拓扑
        </el-button>
        <el-button @click="resetView">
          <el-icon><FullScreen /></el-icon>
          重置视图
        </el-button>
        <el-button @click="toggleLayout">
          <el-icon><Grid /></el-icon>
          {{ layoutType === 'hierarchical' ? '层次布局' : '力导向布局' }}
        </el-button>
      </el-button-group>
      
      <div class="topology-info">
        <el-tag>节点: {{ nodes.length }}</el-tag>
        <el-tag type="success">链路: {{ edges.length }}</el-tag>
      </div>
    </div>

    <!-- 拓扑图容器 -->
    <div ref="networkContainer" class="network-container"></div>

    <!-- 节点详情面板 -->
    <el-drawer
      v-model="showNodeDetail"
      title="节点详情"
      direction="rtl"
      size="400px"
    >
      <div v-if="selectedNode" class="node-detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="节点ID">
            {{ selectedNode.id }}
          </el-descriptions-item>
          <el-descriptions-item label="节点类型">
            <el-tag :type="getNodeTypeColor(selectedNode.type)">
              {{ getNodeTypeLabel(selectedNode.type) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="连接状态">
            <el-tag :type="selectedNode.status === 'connected' ? 'success' : 'danger'">
              {{ selectedNode.status === 'connected' ? '已连接' : '未连接' }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <!-- 端口信息 -->
        <div v-if="selectedNode.connectors && selectedNode.connectors.length > 0" class="node-ports">
          <h4>端口信息</h4>
          <el-table :data="selectedNode.connectors" size="small">
            <el-table-column prop="id" label="端口ID" width="120" />
            <el-table-column prop="name" label="端口名称" />
            <el-table-column label="状态">
              <template #default="scope">
                <el-tag size="small" :type="scope.row.state === 'LIVE' ? 'success' : 'danger'">
                  {{ scope.row.state || '未知' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Network, DataSet } from 'vis-network/standalone/esm/vis-network'
import { topologyService } from '../../services/topology.js'
import { ElMessage } from 'element-plus'

// 响应式数据
const networkContainer = ref(null)
const network = ref(null)
const nodes = ref([])
const edges = ref([])
const loading = ref(false)
const showNodeDetail = ref(false)
const selectedNode = ref(null)
const layoutType = ref('hierarchical')

// 网络配置
// 网络配置
const networkOptions = ref({
  nodes: {
    shape: 'dot',
    size: 20,
    font: {
      size: 14,
      color: '#343434'
    },
    borderWidth: 2,
    shadow: true
  },
  edges: {
    width: 2,
    color: { inherit: 'from' },
    smooth: {
      type: 'continuous',
      forceDirection: 'none'
    },
    arrows: {
      to: { enabled: true, scaleFactor: 1 }
    }
  },
  physics: {
    enabled: true,
    stabilization: { iterations: 100 }
  },
  layout: {
    hierarchical: {
      enabled: true,
      direction: 'UD',
      sortMethod: 'directed',
      nodeSpacing: 200,
      levelSeparation: 150
    }
  },
  interaction: {
    hover: true,
    selectConnectedEdges: false,
    navigationButtons: true,
    keyboard: true
  }
})

// 获取拓扑数据
// 加载拓扑数据
const loadTopology = async () => {
  loading.value = true;
  try {
    // 获取节点和链路数据
    const [topologyNodes, topologyLinks] = await Promise.all([
      topologyService.getTopologyNodes(),
      topologyService.getTopologyLinks()
    ]);

    console.log('原始节点数据:', topologyNodes);
    console.log('原始链路数据:', topologyLinks);
    
    // 处理节点数据
    nodes.value = topologyNodes.map(node => ({
      id: node.id,
      label: node.label || node.id,
      type: node.type || 'unknown',
      status: node.status || 'unknown',
      color: getNodeColor(node.type),
      connectors: node.connectors || [],
      ...node
    }));
    
    // 处理链路数据
    edges.value = topologyLinks.map(link => ({
      id: link.id || `link-${link.from}-${link.to}`,
      from: link.from,
      to: link.to,
      label: link.label || '',
      ...link
    }));
    
    console.log('处理后节点数据:', nodes.value);
    console.log('处理后链路数据:', edges.value);
    
    // 更新网络图 - 避免使用setData方法
    if (network.value) {
      // 销毁现有网络
      network.value.destroy();
      network.value = null;
    }
    
    // 重新初始化网络
    await nextTick();
    initNetwork();

    ElMessage.success(`拓扑加载成功：${nodes.value.length}个节点，${edges.value.length}条链路`);
  } catch (error) {
    console.error('加载拓扑失败:', error);
    ElMessage.error('加载拓扑失败：' + error.message);
    
    // 使用模拟数据
    loadMockData();
  } finally {
    loading.value = false;
  }
};

// 加载模拟数据
const loadMockData = () => {
  nodes.value = [
    { id: 'openflow:1', label: 'Switch-1', type: 'switch', status: 'connected', color: '#409EFF' },
    { id: 'openflow:2', label: 'Switch-2', type: 'switch', status: 'connected', color: '#409EFF' },
    { id: 'openflow:3', label: 'Switch-3', type: 'switch', status: 'disconnected', color: '#F56C6C' },
    { id: 'host:1', label: 'Host-1', type: 'host', status: 'connected', color: '#67C23A' },
    { id: 'host:2', label: 'Host-2', type: 'host', status: 'connected', color: '#67C23A' },
    { id: 'host:3', label: 'Host-3', type: 'host', status: 'connected', color: '#67C23A' }
  ]

  edges.value = [
    { id: 'link1', from: 'openflow:1', to: 'openflow:2', label: 'Link-1-2' },
    { id: 'link2', from: 'openflow:2', to: 'openflow:3', label: 'Link-2-3' },
    { id: 'link3', from: 'openflow:1', to: 'host:1', label: 'Link-1-H1' },
    { id: 'link4', from: 'openflow:2', to: 'host:2', label: 'Link-2-H2' },
    { id: 'link5', from: 'openflow:3', to: 'host:3', label: 'Link-3-H3' }
  ]

  if (network.value) {
    network.value.setData({ nodes: nodes.value, edges: edges.value })
  }
}

// 获取节点状态
const getNodeStatus = (node) => {
  if (node['flow-node-inventory:switch-features']) {
    return 'connected'
  }
  return 'disconnected'
}

// 获取节点颜色
const getNodeColor = (type) => {
  const colors = {
    switch: '#409EFF',
    host: '#67C23A',
    controller: '#E6A23C',
    unknown: '#909399'
  }
  return colors[type] || colors.unknown
}

// 获取节点类型颜色
const getNodeTypeColor = (type) => {
  const colors = {
    switch: 'primary',
    host: 'success',
    controller: 'warning',
    unknown: 'info'
  }
  return colors[type] || colors.unknown
}

// 获取节点类型标签
const getNodeTypeLabel = (type) => {
  const labels = {
    switch: '交换机',
    host: '主机',
    controller: '控制器',
    unknown: '未知'
  }
  return labels[type] || labels.unknown
}

// 刷新拓扑
const refreshTopology = () => {
  loadTopology()
}

// 重置视图
const resetView = () => {
  if (network.value) {
    network.value.fit()
  }
}

// 切换布局
const toggleLayout = () => {
  if (layoutType.value === 'hierarchical') {
    layoutType.value = 'force'
    networkOptions.value.layout.hierarchical.enabled = false
    networkOptions.value.physics.enabled = true
  } else {
    layoutType.value = 'hierarchical'
    networkOptions.value.layout.hierarchical.enabled = true
    networkOptions.value.physics.enabled = false
  }
  
  if (network.value) {
    network.value.setOptions(networkOptions.value)
  }
}

// 初始化网络图
const initNetwork = () => {
  if (networkContainer.value) {
    try {
      // 使用DataSet创建节点和边数据
      const visNodes = new DataSet(
        nodes.value.map(node => ({
          id: node.id,
          label: node.label || node.id,
          shape: node.type === 'host' ? 'box' : 'circle',
          color: node.color || getNodeColor(node.type)
        }))
      );
      
      const visEdges = new DataSet(
        edges.value.map(edge => ({
          id: edge.id,
          from: edge.from,
          to: edge.to,
          label: edge.label || ''
        }))
      );
      
      // 使用DataSet对象创建网络
      const data = {
        nodes: visNodes,
        edges: visEdges
      };
      
      // 创建网络图实例
      network.value = new Network(
        networkContainer.value,
        data,
        networkOptions.value
      );
      
      console.log('网络图初始化成功', {
        nodes: visNodes.length,
        edges: visEdges.length
      });
      
      // 添加事件监听
      network.value.on('click', (params) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          selectedNode.value = nodes.value.find(node => node.id === nodeId);
          showNodeDetail.value = true;
        }
      });
    } catch (error) {
      console.error('网络图初始化失败:', error);
    }
  }
}

// 组件挂载
onMounted(async () => {
  await initNetwork()
  await loadTopology()
})

// 组件卸载
onUnmounted(() => {
  if (network.value) {
    network.value.destroy()
  }
})
</script>

<style scoped>
.topology-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.topology-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: #fff;
  border-bottom: 1px solid #e6e6e6;
  margin-bottom: 0;
}

.topology-info {
  display: flex;
  gap: 10px;
}

.network-container {
  flex: 1;
  background: #fff;
  border: 1px solid #e6e6e6;
  border-radius: 4px;
}

.node-detail {
  padding: 20px;
}

.node-ports {
  margin-top: 20px;
}

.node-ports h4 {
  margin-bottom: 15px;
  color: #303133;
}
</style>