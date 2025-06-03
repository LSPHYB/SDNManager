import { apiClient } from './api.js'
import { API_ENDPOINTS } from '../utils/constants.js'

// 设备服务
export const deviceService = {
  // 获取所有设备
  async getDevices() {
    try {
      // 从inventory端点获取所有节点
      const allNodes = await this.getAllNodes()
      
      // 从拓扑端点获取主机信息
      const topologyHosts = await this.getTopologyHosts()
      
      // 合并设备列表
      const allDevices = [...allNodes, ...topologyHosts]
      
      // 去重（基于ID）
      const uniqueDevices = allDevices.filter((device, index, self) => 
        index === self.findIndex(d => d.id === device.id)
      )
      
      console.log(`获取到 ${uniqueDevices.length} 个设备`)
      return uniqueDevices
    } catch (error) {
      console.error('获取设备列表失败:', error)
      return []
    }
  },

  // 从inventory获取所有节点
  async getAllNodes() {
    const endpoints = [API_ENDPOINTS.NODES, API_ENDPOINTS.NODES_PROXY]
    
    for (const endpoint of endpoints) {
      try {
        console.log(`尝试设备端点: ${endpoint}`)
        const response = await apiClient.get(endpoint)
        console.log('设备数据响应:', response.data)
        
        const nodes = response.data?.nodes?.node || []
        
        return nodes.map(node => ({
          id: node.id,
          name: node.id,
          type: this.getDeviceType(node),
          status: this.getDeviceStatus(node),
          connectors: node['node-connector'] || [],
          ...node
        }))
      } catch (error) {
        console.warn(`设备端点 ${endpoint} 失败:`, error.response?.status, error.message)
        continue
      }
    }
    
    return []
  },

  // 从拓扑获取主机信息
  async getTopologyHosts() {
    const endpoints = [
      API_ENDPOINTS.TOPOLOGY,
      API_ENDPOINTS.TOPOLOGY_ALT,
      API_ENDPOINTS.HOSTS_ALT
    ]
    
    for (const endpoint of endpoints) {
      try {
        console.log(`尝试拓扑端点获取主机: ${endpoint}`)
        const response = await apiClient.get(endpoint)
        console.log('拓扑数据响应:', response.data)
        
        const hosts = []
        
        // 处理network-topology格式
        if (response.data?.['network-topology']?.topology) {
          response.data['network-topology'].topology.forEach(topo => {
            if (topo.node) {
              topo.node.forEach(node => {
                const nodeId = node['node-id'] || node.id || ''
                // 识别主机节点
                if (nodeId.includes('host:') || this.isHostNode(node)) {
                  // 提取主机连接点信息
                  const connectors = this.extractHostConnectors(node);
                  
                  hosts.push({
                    id: nodeId,
                    name: nodeId,
                    type: 'host',
                    status: 'connected',
                    connectors: connectors, // 使用提取的连接点
                    ...node
                  })
                }
              })
            }
          })
        }
        
        console.log(`从拓扑获取到 ${hosts.length} 个主机`)
        return hosts
        
      } catch (error) {
        console.warn(`拓扑端点 ${endpoint} 失败:`, error.response?.status, error.message)
        continue
      }
    }
    
    return []
  },

  // 提取主机连接点信息
  extractHostConnectors(node) {
    const connectors = [];
    
    // 处理attachment-points格式
    if (node['host-tracker-service:attachment-points'] && 
        Array.isArray(node['host-tracker-service:attachment-points'])) {
      node['host-tracker-service:attachment-points'].forEach(ap => {
        connectors.push({
          id: ap['tp-id'] || '',
          name: ap['tp-id'] || '',
          state: 'LIVE',
          currentSpeed: '1000', // 默认值
          maximumSpeed: '1000', // 默认值
          isHostPort: true
        });
      });
    }
    
    // 处理addresses格式
    if (node['host-tracker-service:addresses'] && 
        Array.isArray(node['host-tracker-service:addresses'])) {
      // 如果已经有连接点，不再添加地址作为连接点
      if (connectors.length === 0) {
        node['host-tracker-service:addresses'].forEach((addr, index) => {
          connectors.push({
            id: `addr-${index}`,
            name: addr.ip || addr.mac || `地址-${index}`,
            state: 'LIVE',
            currentSpeed: '未知',
            maximumSpeed: '未知',
            isHostPort: true,
            ip: addr.ip,
            mac: addr.mac
          });
        });
      }
    }
    
    return connectors;
  },

  // 判断是否为主机节点
  isHostNode(node) {
    const nodeId = node['node-id'] || node.id || ''
    
    // 检查节点ID格式
    if (nodeId.includes('host:')) return true
    
    // 检查是否有主机特征
    if (node['host-tracker-service:addresses'] || 
        node['address-tracker:addresses']) {
      return true
    }
    
    // 检查终端点信息中是否包含主机信息
    if (node['termination-point']) {
      return node['termination-point'].some(tp => 
        tp['tp-id'] && tp['tp-id'].includes('host')
      )
    }
    
    return false
  },

  // 获取设备详情
  async getDeviceDetail(nodeId) {
    try {
      const response = await apiClient.get(API_ENDPOINTS.NODE_DETAIL(nodeId))
      return response.data?.node?.[0] || null
    } catch (error) {
      console.error('获取设备详情失败:', error)
      throw error
    }
  },

  // 获取设备统计信息
  async getDeviceStats(nodeId) {
    try {
      const response = await apiClient.get(API_ENDPOINTS.NODE_STATS(nodeId))
      return response.data
    } catch (error) {
      console.error('获取设备统计失败:', error)
      return null
    }
  },

  // 判断设备类型 - 增强逻辑
  getDeviceType(node) {
    const nodeId = node.id || node['node-id'] || ''
    
    // 检查是否有主机跟踪服务信息
    if (node['host-tracker-service:addresses'] || 
        node['address-tracker:addresses']) {
      return 'host'
    }
    
    // 基于ID的判断
    if (nodeId.includes('openflow:')) {
      return 'switch'
    } else if (nodeId.includes('host:')) {
      return 'host'
    }
    
    // 检查是否有交换机特征
    if (node['flow-node-inventory:switch-features'] || 
        node['flow-node-inventory:description'] ||
        (node['node-connector'] && node['node-connector'].length > 0)) {
      return 'switch'
    }
    
    // 检查MAC地址格式的ID - 可能是主机
    if (nodeId.match(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)) {
      return 'host'
    }
    
    return 'unknown'
  },

  // 判断设备状态
  getDeviceStatus(node) {
    // 对于主机，如果能获取到就认为是连接的
    if (this.getDeviceType(node) === 'host') {
      return 'connected'
    }
    
    // 对于交换机，检查更多状态信息
    if (node['flow-node-inventory:switch-features'] || 
        node['flow-node-inventory:description'] || 
        node['flow-node-inventory:hardware'] || 
        (node['node-connector'] && node['node-connector'].length > 0)) {
      return 'connected'
    }
    
    // 检查连接器状态
    if (node['node-connector']) {
      for (const connector of node['node-connector']) {
        if (connector['flow-node-inventory:state'] && 
            connector['flow-node-inventory:state']['link-down'] === false) {
          return 'connected'
        }
      }
    }
    
    return 'disconnected'
  },
}