export const API_ENDPOINTS = {
  // 拓扑相关端点 - Carbon版本正确路径
  TOPOLOGY: '/restconf/operational/network-topology:network-topology',
  TOPOLOGY_ALT: '/restconf/operational/network-topology:network-topology/topology/flow:1', 
  TOPOLOGY_PROXY: '/operational/network-topology:network-topology',
  TOPOLOGY_ALT_PROXY: '/operational/network-topology:network-topology/topology/flow:1',
  OPENFLOW_TOPOLOGY: '/restconf/operational/network-topology:network-topology/topology/openflow:1',
  
  // 设备管理相关 - 修改为Carbon版本兼容的路径
  NODES: '/restconf/operational/opendaylight-inventory:nodes',
  NODES_PROXY: '/operational/opendaylight-inventory:nodes',
  NODE_DETAIL: (nodeId) => `/restconf/operational/opendaylight-inventory:nodes/node/${nodeId}`,
  
  // 主机跟踪相关端点 - Carbon版本正确路径
  HOSTS: '/restconf/operational/opendaylight-inventory:nodes',
  HOSTS_ALT: '/restconf/operational/network-topology:network-topology/topology/flow:1',
  HOSTS_PROXY: '/operational/opendaylight-inventory:nodes',
  
  // 流表管理相关 - 已修复的路径
  FLOWS: (nodeId) => `/restconf/operational/opendaylight-inventory:nodes/node/${nodeId}/flow-node-inventory:table/0`,
  FLOWS_ALT: (nodeId) => `/restconf/operational/opendaylight-inventory:nodes/node/${nodeId}/table/0`,
  FLOWS_ALL_TABLES: (nodeId) => `/restconf/operational/opendaylight-inventory:nodes/node/${nodeId}`,
  // 流表管理相关 - 已修复的路径
  FLOW_CONFIG: (nodeId, tableId, flowId) => `/restconf/config/opendaylight-inventory:nodes/node/${nodeId}/flow-node-inventory:table/${tableId}/flow/${encodeURIComponent(flowId)}`,
  FLOW_CONFIG_ALT: (nodeId, tableId, flowId) => `/restconf/config/opendaylight-inventory:nodes/node/${nodeId}/table/${tableId}/flow/${encodeURIComponent(flowId)}`,
  
  // 统计信息
  NODE_STATS: (nodeId) => `/restconf/operational/opendaylight-inventory:nodes/node/${nodeId}/flow-node-inventory:table/0/flow-statistics-data`
}

// 设备类型常量
export const DEVICE_TYPES = {
  SWITCH: 'switch',
  HOST: 'host',
  CONTROLLER: 'controller'
}

// 连接状态常量
export const CONNECTION_STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting'
}

// 流表动作类型
export const FLOW_ACTIONS = {
  OUTPUT: 'output',
  DROP: 'drop',
  FLOOD: 'flood',
  CONTROLLER: 'controller'
}

// 匹配字段类型
export const MATCH_FIELDS = {
  IN_PORT: 'in-port',
  ETH_SRC: 'ethernet-source',
  ETH_DST: 'ethernet-destination',
  ETH_TYPE: 'ethernet-type',
  IP_SRC: 'ipv4-source',
  IP_DST: 'ipv4-destination'
}