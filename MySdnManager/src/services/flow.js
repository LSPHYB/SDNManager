import apiClient from './api.js'
import { API_ENDPOINTS } from '../utils/constants.js'

// 流表服务
export const flowService = {
  // 检查节点是否支持流表查询
  isFlowCapableNode(nodeId) {
    // Host节点不支持流表查询
    if (nodeId.startsWith('host:')) {
      return false;
    }
    // OpenFlow节点支持流表查询
    if (nodeId.startsWith('openflow:')) {
      return true;
    }
    // 其他情况根据节点ID格式判断
    return !nodeId.includes('host');
  },

  // 获取设备的所有流表 - 增加节点类型检查
  async getFlows(nodeId) {
    // 检查节点是否支持流表查询
    if (!this.isFlowCapableNode(nodeId)) {
      console.warn(`节点 ${nodeId} 是Host节点，不支持流表查询`);
      return {
        flows: [],
        message: 'Host节点不支持流表查询，只有OpenFlow交换机节点才具备流表功能'
      };
    }

    // 尝试多个端点
    const endpoints = [
      API_ENDPOINTS.FLOWS(nodeId),
      API_ENDPOINTS.FLOWS_ALT(nodeId),
      API_ENDPOINTS.FLOWS_ALL_TABLES(nodeId)
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`尝试获取节点 ${nodeId} 的流表，端点: ${endpoint}`);
        const response = await apiClient.get(endpoint);
        console.log('流表原始数据:', response.data);
        
        // 处理不同的响应结构
        let tables = [];
        
        if (endpoint === API_ENDPOINTS.FLOWS_ALL_TABLES(nodeId)) {
          // 处理完整节点数据结构
          tables = response.data?.['flow-node-inventory:table'] || 
                  response.data?.['node']?.['flow-node-inventory:table'] || [];
        } else {
          // 处理单个表数据结构
          const table = response.data;
          if (table && (table.id !== undefined || table['flow-node-inventory:id'] !== undefined)) {
            tables = [table];
          } else {
            tables = response.data?.['flow-node-inventory:table'] || 
                    response.data?.table || [];
          }
        }
        
        // 提取所有流表中的流表项
        const flows = [];
        tables.forEach(table => {
          // 处理不同的数据结构
          const tableId = table.id || table['flow-node-inventory:id'] || 0;
          const tableFlows = table.flow || 
                      table['flow-node-inventory:flow'] || [];
          
          if (tableFlows.length > 0) {
            tableFlows.forEach(flow => {
              flows.push({
                ...flow,
                tableId: tableId,
                nodeId: nodeId,
                // 确保关键字段存在
                id: flow.id || flow['flow-id'] || `flow-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                priority: flow.priority || 0,
                match: flow.match || {},
                instructions: flow.instructions || {instruction: []}
              })
            })
          }
        })
        
        console.log('处理后的流表数据:', flows);
        return flows;
      } catch (error) {
        console.error(`端点 ${endpoint} 获取流表失败:`, error);
        // 继续尝试下一个端点
      }
    }
    
    console.error('所有流表端点都失败');
    return [];
  },

  // 获取流表详情
  async getFlowDetail(nodeId, tableId, flowId) {
    try {
      const response = await apiClient.get(API_ENDPOINTS.FLOW_CONFIG(nodeId, tableId, flowId))
      return response.data?.flow?.[0] || null
    } catch (error) {
      console.error('获取流表详情失败:', error)
      return null
    }
  },

  // 创建流表项
  async createFlow(nodeId, tableId, flow) {
    try {
      const flowData = {
        ...flow,
        'table_id': tableId,
        'id': flow.id
      }
      
      const response = await apiClient.put(
        API_ENDPOINTS.FLOW_CONFIG(nodeId, tableId, flow.id),
        { flow: [flowData] }
      )
      
      return response.data
    } catch (error) {
      console.error('创建流表失败:', error)
      throw error
    }
  },

  // 删除流表项
  async deleteFlow(nodeId, tableId, flowId) {
    try {
      const response = await apiClient.delete(API_ENDPOINTS.FLOW_CONFIG(nodeId, tableId, flowId))
      return response.data
    } catch (error) {
      console.error('删除流表失败:', error)
      throw error
    }
  },

  // 生成流表项模板
  generateFlowTemplate(nodeId, tableId) {
    return {
      id: `flow-${Date.now()}`,
      'table_id': tableId,
      priority: 100,
      'idle-timeout': 0,
      'hard-timeout': 0,
      match: {},
      instructions: {
        instruction: [
          {
            order: 0,
            'apply-actions': {
              action: [
                {
                  order: 0,
                  output: {
                    'output-node-connector': 'NORMAL',
                    'max-length': 65535
                  }
                }
              ]
            }
          }
        ]
      }
    }
  },

  // 解析匹配条件
  parseMatch(match) {
    if (!match) return '任意数据包'
    
    const matchParts = []
    
    if (match['in-port']) {
      matchParts.push(`入端口: ${match['in-port']}`)
    }
    
    if (match['ethernet-match']) {
      const ethMatch = match['ethernet-match']
      
      if (ethMatch['ethernet-source']) {
        matchParts.push(`源MAC: ${ethMatch['ethernet-source']['address']}`)
      }
      
      if (ethMatch['ethernet-destination']) {
        matchParts.push(`目的MAC: ${ethMatch['ethernet-destination']['address']}`)
      }
      
      if (ethMatch['ethernet-type']) {
        matchParts.push(`以太网类型: ${ethMatch['ethernet-type']['type']}`)
      }
    }
    
    if (match['ip-match']) {
      matchParts.push(`IP协议: ${match['ip-match']['ip-protocol']}`)
    }
    
    if (match['ipv4-source']) {
      matchParts.push(`源IP: ${match['ipv4-source']}`)
    }
    
    if (match['ipv4-destination']) {
      matchParts.push(`目的IP: ${match['ipv4-destination']}`)
    }
    
    return matchParts.length > 0 ? matchParts.join(', ') : '任意数据包'
  },

  // 解析动作
  parseActions(instructions) {
    if (!instructions || !instructions.instruction) return '无动作'
    
    const actions = []
    
    instructions.instruction.forEach(instruction => {
      if (instruction['apply-actions'] && instruction['apply-actions'].action) {
        instruction['apply-actions'].action.forEach(action => {
          if (action.output) {
            const port = action.output['output-node-connector']
            actions.push(`转发到端口: ${port}`)
          } else if (action.drop) {
            actions.push('丢弃')
          } else if (action['controller-action']) {
            actions.push('发送到控制器')
          } else if (action['flood-action']) {
            actions.push('泛洪')
          }
        })
      }
    })
    
    return actions.length > 0 ? actions.join(', ') : '无动作'
  }
}