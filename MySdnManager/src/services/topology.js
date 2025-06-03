import apiClient from './api.js'
import { API_ENDPOINTS } from '../utils/constants.js'

// 拓扑服务
export const topologyService = {
  // 获取网络拓扑 - 支持多种端点尝试
  async getTopology() {
    const endpoints = [
      // 首先尝试完整RESTCONF路径
      API_ENDPOINTS.TOPOLOGY,
      API_ENDPOINTS.TOPOLOGY_ALT,
      // 然后尝试代理路径
      API_ENDPOINTS.TOPOLOGY_PROXY,
      API_ENDPOINTS.TOPOLOGY_ALT_PROXY,
      // 最后尝试OpenFlow特定拓扑
      API_ENDPOINTS.OPENFLOW_TOPOLOGY,
      // 新增主机拓扑端点
      API_ENDPOINTS.HOST_TOPOLOGY
    ]
    
    for (const endpoint of endpoints) {
      try {
        console.log(`尝试端点: ${endpoint}`)
        const response = await apiClient.get(endpoint)
        console.log('拓扑数据获取成功:', response.data)
        
        // 验证数据结构
        if (this.validateTopologyData(response.data)) {
          return response.data
        } else {
          console.warn(`端点 ${endpoint} 返回的数据格式不正确`)
          continue
        }
      } catch (error) {
        console.warn(`端点 ${endpoint} 失败:`, error.response?.status, error.message)
        continue
      }
    }
    
    throw new Error('所有拓扑端点都无法访问或返回有效数据')
  },

  // 验证拓扑数据格式
  validateTopologyData(data) {
    return data && (
      data['network-topology'] || 
      data.topology || 
      data.nodes
    )
  },

  // 获取设备节点 - 使用inventory端点
  async getNodes() {
    const endpoints = [
      API_ENDPOINTS.NODES,
      API_ENDPOINTS.NODES_PROXY
    ]
    
    for (const endpoint of endpoints) {
      try {
        console.log(`尝试获取设备节点: ${endpoint}`)
        const response = await apiClient.get(endpoint)
        console.log('设备数据:', response.data)
        
        const nodes = []
        if (response.data && response.data.nodes && response.data.nodes.node) {
          response.data.nodes.node.forEach(node => {
            nodes.push({
              id: node.id,
              label: node.id,
              type: this.getNodeType(node),
              connectors: node['node-connector'] || [],
              ...node
            })
          })
        }
        
        return nodes
      } catch (error) {
        console.warn(`设备端点 ${endpoint} 失败:`, error.response?.status)
        continue
      }
    }
    
    console.error('所有设备端点都无法访问')
    return []
  },

  // 获取拓扑节点
  // 获取拓扑节点
  async getTopologyNodes() {
    try {
      // 首先尝试从拓扑获取
      const topology = await this.getTopology()
      const networks = topology['network-topology']?.topology || []
      const nodes = []
      
      networks.forEach(network => {
        if (network.node) {
          network.node.forEach(node => {
            const nodeId = node['node-id'] || node.id || ''
            if (nodeId) {
              const nodeType = this.getNodeType(node)
              
              const nodeObj = {
                id: nodeId,
                label: this.formatNodeLabel(nodeId, nodeType),
                type: nodeType,
                connectors: node['termination-point'] || node['node-connector'] || [],
                ...node
              }
              
              console.log(`处理节点: ${nodeId}, 类型: ${nodeType}`)
              nodes.push(nodeObj)
            }
          })
        }
      })
      
      // 如果拓扑中没有足够的节点，尝试从设备服务获取
      if (nodes.length === 0) {
        console.log('拓扑中无节点，尝试从设备服务获取')
        const { deviceService } = await import('./device.js')
        const devices = await deviceService.getDevices()
        
        return devices.map(device => ({
          id: device.id,
          label: this.formatNodeLabel(device.id, device.type),
          type: device.type,
          connectors: device.connectors || [],
          ...device
        }))
      }
      
      console.log('处理后的节点数据:', nodes)
      return nodes
    } catch (error) {
      console.error('获取拓扑节点失败，尝试设备服务')
      const { deviceService } = await import('./device.js')
      const devices = await deviceService.getDevices()
      
      return devices.map(device => ({
        id: device.id,
        label: this.formatNodeLabel(device.id, device.type),
        type: device.type,
        connectors: device.connectors || [],
        ...device
      }))
    }
  },
  
  // 格式化节点标签
  formatNodeLabel(nodeId, nodeType) {
    if (!nodeId) return 'Unknown';
    
    if (nodeType === 'switch' || nodeId.includes('openflow:')) {
      const parts = nodeId.split(':');
      return `Switch-${parts[parts.length-1]}`;
    } else if (nodeType === 'host' || nodeId.includes('host:')) {
      // 对于主机，使用MAC地址的最后部分
      const macParts = nodeId.split(':');
      if (macParts.length >= 3) {
        return `Host-${macParts[macParts.length-3]}:${macParts[macParts.length-2]}:${macParts[macParts.length-1]}`;
      }
      return `Host-${nodeId.split(':')[1] || ''}`;
    }
    
    return nodeId;
  },

  // 获取拓扑链路
  // 获取拓扑链路
  async getTopologyLinks() {
    try {
      const topology = await this.getTopology();
      console.log('原始拓扑数据:', JSON.stringify(topology));
      const networks = topology['network-topology']?.topology || [];
      const links = [];
      
      networks.forEach(network => {
        if (network.link) {
          network.link.forEach(link => {
            console.log('处理链路:', link);
            // 增强的链路源目标解析 - 支持Carbon版本的多种格式
            let sourceNode = '';
            let destNode = '';
            
            // 处理source节点
            if (typeof link.source === 'object') {
              console.log('链路源是对象:', link.source);
              sourceNode = link.source['source-node'] || 
                         (link.source['source-tp'] ? link.source['source-tp'].split(':')[0] : '') || 
                         link.source.id || 
                         '';
            } else {
              sourceNode = link.source || '';
            }
            
            // 处理destination节点
            if (typeof link.destination === 'object') {
              console.log('链路目标是对象:', link.destination);
              destNode = link.destination['dest-node'] || 
                       (link.destination['dest-tp'] ? link.destination['dest-tp'].split(':')[0] : '') || 
                       link.destination.id || 
                       '';
            } else {
              destNode = link.destination || '';
            }
            
            // 规范化节点ID格式
            sourceNode = this.normalizeNodeId(sourceNode);
            destNode = this.normalizeNodeId(destNode);
            
            console.log(`提取的源节点: ${sourceNode}, 目标节点: ${destNode}`);
            
            // 只有当源节点和目标节点都存在时才添加链路
            if (sourceNode && destNode) {
              // 创建新对象，不保留原始link对象的source和destination
              const newLink = {
                id: link['link-id'] || `link-${sourceNode}-${destNode}`,
                source: sourceNode,
                target: destNode,
                from: sourceNode,  // 兼容性
                to: destNode,      // 兼容性
                label: this.formatLinkLabel(sourceNode, destNode)
              };
              
              // 复制其他需要的属性
              if (link.type) newLink.type = link.type;
              if (link.status) newLink.status = link.status;
              
              links.push(newLink);
            } else {
              console.warn('链路缺少源节点或目标节点:', link);
            }
          });
        }
      });
      
      console.log('处理后的链路数据:', links);
      return links;
    } catch (error) {
      console.error('获取拓扑链路失败:', error);
      return [];
    }
  },
  
  // 规范化节点ID
  normalizeNodeId(nodeId) {
    if (!nodeId) return '';
    
    // 处理主机ID格式 - Carbon版本可能有多种格式
    if (nodeId.includes('host:')) {
      return nodeId;
    }
    
    // 处理主机跟踪服务格式
    if (nodeId.match(/^host:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}$/i)) {
      return nodeId;
    }
    
    // 处理OpenFlow交换机ID
    if (nodeId.includes('openflow:')) {
      return nodeId;
    }
    
    return nodeId;
  },
  
  // 格式化链路标签
  formatLinkLabel(source, dest) {
    const sourceLabel = source.split(':')[0];
    const destLabel = dest.split(':')[0];
    return `${sourceLabel}→${destLabel}`;
  },

  // 判断节点类型
  // 判断节点类型
  getNodeType(node) {
    // 获取节点ID，支持多种格式
    const nodeId = node['node-id'] || node.id || '';
    
    // 检查节点ID是否包含host标识
    if (nodeId.includes('host:') || 
        (node['host-tracker-service:addresses'] && node['host-tracker-service:addresses'].length > 0) ||
        (node['addresses'] && node['addresses'].length > 0)) {
      return 'host';
    }
    
    // 检查是否有终端点信息或流表 - 这通常表示是交换机
    if (node['termination-point'] || 
        node['flow-node-inventory:switch-features'] || 
        nodeId.includes('openflow:')) {
      return 'switch';
    }
    
    // 检查MAC地址格式 - 可能是主机
    if (nodeId.match(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)) {
      return 'host';
    }
    
    // 默认返回unknown类型
    return 'unknown';
  },
}