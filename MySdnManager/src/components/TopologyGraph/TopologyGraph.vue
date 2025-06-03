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
          {{ layoutType === 'dagre' ? '层次布局' : '力导向布局' }}
        </el-button>
      </el-button-group>
      
      <div class="topology-info">
        <el-tag>节点: {{ nodes.length }}</el-tag>
        <el-tag type="success">链路: {{ edges.length }}</el-tag>
      </div>
    </div>

    <!-- 拓扑图容器 -->
    <div ref="cytoscapeContainer" class="cytoscape-container"></div>

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
          <el-descriptions-item label="节点IP">
            {{ getNodeIpAddress(selectedNode) }}
          </el-descriptions-item>
          <el-descriptions-item label="节点类型">
            <el-tag :type="getNodeTypeColor(selectedNode.type)">
              {{ getNodeTypeLabel(selectedNode.type) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="连接状态">
            <el-tag type="success">已连接</el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <!-- 端口信息 -->
        <div v-if="selectedNode && getNodePorts(selectedNode).length > 0" class="node-ports">
          <h4>端口信息</h4>
          <el-table :data="getNodePorts(selectedNode)" size="small">
            <el-table-column prop="id" label="端口ID" width="120" />
            <el-table-column prop="name" label="端口名称" />
            <el-table-column label="状态">
              <template #default="scope">
                <el-tag size="small" type="success">
                  已连接
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
import cytoscape from 'cytoscape'
import cola from 'cytoscape-cola'
import dagre from 'cytoscape-dagre'
import { topologyService } from '../../services/topology.js'
import { ElMessage } from 'element-plus'

// 注册Cytoscape布局插件
cytoscape.use(cola)
cytoscape.use(dagre)

// 响应式数据
const cytoscapeContainer = ref(null)
const cy = ref(null)
const nodes = ref([])
const edges = ref([])
const loading = ref(false)
const showNodeDetail = ref(false)
const selectedNode = ref(null)
const layoutType = ref('dagre') // 默认使用层次布局

// Cytoscape样式
const cytoscapeStyle = [
  {
    selector: 'node',
    style: {
      'label': 'data(label)',
      'text-valign': 'bottom', // 将文本移到节点下方
      'text-halign': 'center',
      'font-size': '12px',
      'text-outline-width': 2,
      'text-outline-color': '#fff',
      'color': '#000',
      'width': 50,
      'height': 50,
      'border-width': 0, // 移除边框
      'background-opacity': 0 // 使背景透明，只显示图片
    }
  },
  {
    selector: 'node[type="switch"]',
    style: {
      'background-image': '/icons/switch.png',
      'background-fit': 'contain', // 使用contain而不是cover，保持图片原始比例
      'background-clip': 'none', // 不裁剪背景图片
      'background-width': '100%',
      'background-height': '100%'
    }
  },
  {
    selector: 'node[type="host"]',
    style: {
      'background-image': '/icons/host.png',
      'background-fit': 'contain', // 使用contain而不是cover，保持图片原始比例
      'background-clip': 'none', // 不裁剪背景图片
      'background-width': '100%',
      'background-height': '100%'
    }
  },
  {
    selector: 'node[type="controller"]',
    style: {
      'background-image': '/icons/controller.png',
      'background-fit': 'contain', // 使用contain而不是cover，保持图片原始比例
      'background-clip': 'none', // 不裁剪背景图片
      'background-width': '100%',
      'background-height': '100%'
    }
  },
  {
    selector: 'edge',
    style: {
      'width': 2,
      'line-color': '#999',
      'target-arrow-color': '#999',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'label': 'data(label)',
      'font-size': '10px',
      'text-rotation': 'autorotate',
      'text-margin-y': -10
    }
  },
  {
    selector: ':selected',
    style: {
      'border-width': 3,
      'border-color': '#333',
      'border-opacity': 1
    }
  }
]

// 获取节点端口信息
const getNodePorts = (node) => {
  if (!node) return [];
  
  // 处理不同类型节点的端口信息
  if (node.connectors && Array.isArray(node.connectors)) {
    return node.connectors.map(port => ({
      id: port.id || port['tp-id'] || '',
      name: formatPortName(port.id || port['tp-id'] || ''),
      state: 'LIVE' // 既然在拓扑图中显示，端口状态就是连接的
    }));
  }
  
  // 处理termination-point格式
  if (node['termination-point'] && Array.isArray(node['termination-point'])) {
    return node['termination-point'].map(tp => ({
      id: tp['tp-id'] || '',
      name: formatPortName(tp['tp-id'] || ''),
      state: 'LIVE'
    }));
  }
  
  return [];
}

// 格式化端口名称
const formatPortName = (portId) => {
  if (!portId) return '';
  
  // 提取端口号部分
  const parts = portId.split(':');
  if (parts.length > 1) {
    return `端口 ${parts[parts.length-1]}`;
  }
  
  return portId;
}

// 获取节点IP地址
const getNodeIpAddress = (node) => {
  if (!node) return '未知';
  
  // 检查host-tracker-service:addresses字段
  if (node['host-tracker-service:addresses'] && 
      Array.isArray(node['host-tracker-service:addresses']) && 
      node['host-tracker-service:addresses'].length > 0) {
    // 提取第一个IP地址
    const addresses = node['host-tracker-service:addresses'];
    for (const addr of addresses) {
      if (addr.ip) return addr.ip;
      if (addr['ip-address']) return addr['ip-address'];
    }
  }
  
  // 检查address-tracker:addresses字段
  if (node['address-tracker:addresses'] && 
      Array.isArray(node['address-tracker:addresses']) && 
      node['address-tracker:addresses'].length > 0) {
    // 提取第一个IP地址
    const addresses = node['address-tracker:addresses'];
    for (const addr of addresses) {
      if (addr.ip) return addr.ip;
      if (addr['ip-address']) return addr['ip-address'];
    }
  }
  
  // 检查ip-addresses字段 (另一种可能的格式)
  if (node['ip-addresses'] && 
      Array.isArray(node['ip-addresses']) && 
      node['ip-addresses'].length > 0) {
    const addresses = node['ip-addresses'];
    for (const addr of addresses) {
      if (addr.ip) return addr.ip;
      if (addr['ip-address']) return addr['ip-address'];
    }
  }
  
  // 检查addresses字段 (简化格式)
  if (node.addresses && Array.isArray(node.addresses) && node.addresses.length > 0) {
    for (const addr of node.addresses) {
      if (addr.ip) return addr.ip;
      if (addr['ip-address']) return addr['ip-address'];
    }
  }
  
  // 检查单个ip字段
  if (node.ip) return node.ip;
  
  // 对于交换机节点，可能没有IP或使用节点ID作为IP
  if (node.type === 'switch') {
    // 尝试从节点ID中提取IP部分
    const nodeId = node.id || '';
    if (nodeId.includes(':')) {
      return nodeId.split(':')[0];
    }
  }
  
  return '未知';
}



// 获取拓扑数据
const loadTopology = async () => {
  loading.value = true
  try {
    // 获取节点和链路数据
    const [topologyNodes, topologyLinks] = await Promise.all([
      topologyService.getTopologyNodes(),
      topologyService.getTopologyLinks()
    ])

    console.log('原始节点数据:', topologyNodes)
    console.log('原始链路数据:', topologyLinks)
    
    // 处理节点数据
    nodes.value = topologyNodes.map(node => ({
      id: node.id,
      label: node.label || node.id,
      type: node.type || 'unknown',
      status: node.status || 'unknown',
      color: getNodeColor(node.type),
      connectors: node.connectors || [],
      ...node
    }))
    
    // 处理链路数据
    edges.value = topologyLinks.map(link => {
      // 确保source和target是字符串
      let source = link.from || link.source;
      let target = link.to || link.target;
      
      // 如果source或target是对象，尝试提取ID
      if (typeof source === 'object' && source !== null) {
        console.log('Source是对象:', source);
        source = source.id || source['node-id'] || 
                source['source-node'] || source['source-tp']?.split(':')[0] || 
                JSON.stringify(source);
      }
      
      if (typeof target === 'object' && target !== null) {
        console.log('Target是对象:', target);
        target = target.id || target['node-id'] || 
                target['dest-node'] || target['dest-tp']?.split(':')[0] || 
                JSON.stringify(target);
      }
      
      // 创建新对象，不使用...link展开原始对象，避免覆盖处理后的source和target
      return {
        id: link.id || `link-${source}-${target}`,
        source: source,
        target: target,
        label: link.label || '',
        // 只复制需要的其他属性，而不是使用...link
        type: link.type,
        status: link.status
      };
    });
    
    console.log('处理后节点数据:', nodes.value)
    console.log('处理后链路数据:', edges.value)
    
    // 更新网络图
    if (cy.value) {
      cy.value.elements().remove() // 清除现有元素
      renderCytoscapeElements() // 重新渲染
    } else {
      // 初始化Cytoscape
      await nextTick()
      initCytoscape()
    }

    ElMessage.success(`拓扑加载成功：${nodes.value.length}个节点，${edges.value.length}条链路`)
  } catch (error) {
    console.error('加载拓扑失败:', error)
    ElMessage.error('加载拓扑失败：' + error.message)
    
    // 使用模拟数据
    loadMockData()
  } finally {
    loading.value = false
  }
}

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
    { id: 'link1', source: 'openflow:1', target: 'openflow:2', label: 'Link-1-2' },
    { id: 'link2', source: 'openflow:2', target: 'openflow:3', label: 'Link-2-3' },
    { id: 'link3', source: 'openflow:1', target: 'host:1', label: 'Link-1-H1' },
    { id: 'link4', source: 'openflow:2', target: 'host:2', label: 'Link-2-H2' },
    { id: 'link5', source: 'openflow:3', target: 'host:3', label: 'Link-3-H3' }
  ]

  if (cy.value) {
    cy.value.elements().remove() // 清除现有元素
    renderCytoscapeElements() // 重新渲染
  }
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
  if (cy.value) {
    cy.value.fit()
    cy.value.center()
  }
}

// 切换布局
const toggleLayout = () => {
  if (layoutType.value === 'dagre') {
    layoutType.value = 'cola'
  } else {
    layoutType.value = 'dagre'
  }
  
  if (cy.value) {
    applyLayout()
  }
}

// 应用布局
const applyLayout = () => {
  if (!cy.value) return
  
  let layout
  
  if (layoutType.value === 'dagre') {
    layout = cy.value.layout({
      name: 'dagre',
      rankDir: 'TB',
      nodeSep: 100,
      rankSep: 150,
      padding: 50,
      animate: true,
      animationDuration: 500
    })
  } else {
    layout = cy.value.layout({
      name: 'cola',
      nodeSpacing: 100,
      edgeLengthVal: 150,
      animate: true,
      randomize: false,
      maxSimulationTime: 1500
    })
  }
  
  layout.run()
}

// 初始化Cytoscape
const initCytoscape = () => {
  if (!cytoscapeContainer.value) return
  
  cy.value = cytoscape({
    container: cytoscapeContainer.value,
    // 移除自定义wheelSensitivity或使用默认值
    // wheelSensitivity: 0.3,
    style: cytoscapeStyle, // 这里应该使用之前定义的cytoscapeStyle变量
    minZoom: 0.2,
    maxZoom: 3
  })
  
  // 渲染元素
  renderCytoscapeElements()
  
  // 添加事件监听
  cy.value.on('tap', 'node', (evt) => {
    const node = evt.target
    selectedNode.value = nodes.value.find(n => n.id === node.id())
    showNodeDetail.value = true
  })
  
  console.log('Cytoscape初始化成功')
}

// 渲染Cytoscape元素
const renderCytoscapeElements = () => {
  if (!cy.value) return
  
  console.log('开始渲染节点和边...')
  
  // 添加节点
  nodes.value.forEach(node => {
    try {
      cy.value.add({
        group: 'nodes',
        data: {
          id: node.id,
          label: node.label,
          type: node.type,
          color: node.color,
          status: node.status
        }
      })
    } catch (error) {
      console.error(`添加节点 ${node.id} 失败:`, error)
    }
  })
  
  // 添加边
  edges.value.forEach(edge => {
    try {
      // 再次确保source和target是字符串
      const source = typeof edge.source === 'object' ? 
                    (edge.source.id || JSON.stringify(edge.source)) : edge.source;
      const target = typeof edge.target === 'object' ? 
                    (edge.target.id || JSON.stringify(edge.target)) : edge.target;
                    
      console.log(`添加边: ${edge.id}, 源: ${source}, 目标: ${target}`);
      
      cy.value.add({
        group: 'edges',
        data: {
          id: edge.id,
          source: source,
          target: target,
          label: edge.label
        }
      });
    } catch (error) {
      console.error(`添加边 ${edge.id} 失败:`, error);
    }
  });
  
  // 应用布局
  applyLayout()
}

// 组件挂载
onMounted(async () => {
  await nextTick()
  initCytoscape()
  await loadTopology()
})

// 组件卸载
onUnmounted(() => {
  if (cy.value) {
    cy.value.destroy()
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

.cytoscape-container {
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


