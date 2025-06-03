<template>
  <div class="flow-tables-page">
    <el-card>
      <template #header>
        <div class="page-header">
          <h3>流表管理</h3>
          <div class="header-actions">
            <el-select
              v-model="selectedNodeId"
              placeholder="选择设备"
              style="width: 200px; margin-right: 10px;"
              @change="loadFlows"
            >
              <el-option
                v-for="device in devices"
                :key="device.id"
                :label="device.name || device.id"
                :value="device.id"
              />
            </el-select>
            <el-input
              v-model="searchText"
              placeholder="搜索流表..."
              style="width: 200px; margin-right: 10px;"
              clearable
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-button type="primary" @click="refreshFlows" :loading="loading">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
            <el-button type="success" @click="showAddFlowDialog">
              <el-icon><Plus /></el-icon>
              添加流表
            </el-button>
          </div>
        </div>
      </template>

      <!-- 流表统计 -->
      <div class="flow-stats">
        <el-row :gutter="20">
          <el-col :span="8">
            <div class="stat-item">
              <div class="stat-number">{{ flows.length }}</div>
              <div class="stat-label">总流表数</div>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="stat-item">
              <div class="stat-number">{{ activeFlows }}</div>
              <div class="stat-label">活跃流表</div>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="stat-item">
              <div class="stat-number">{{ selectedNodeId ? 1 : 0 }}</div>
              <div class="stat-label">当前设备</div>
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 流表列表 -->
      <el-table
        :data="filteredFlows"
        v-loading="loading"
        style="width: 100%"
        @row-click="showFlowDetail"
      >
        <el-table-column prop="id" label="流表ID" width="180" />
        <el-table-column prop="tableId" label="表ID" width="80" />
        <el-table-column prop="priority" label="优先级" width="80" />
        <el-table-column label="匹配条件" min-width="200">
          <template #default="scope">
            {{ parseMatch(scope.row.match) }}
          </template>
        </el-table-column>
        <el-table-column label="动作" min-width="200">
          <template #default="scope">
            {{ parseActions(scope.row.instructions) }}
          </template>
        </el-table-column>
        <el-table-column label="超时(秒)" width="120">
          <template #default="scope">
            {{ scope.row['idle-timeout'] || '-' }} / {{ scope.row['hard-timeout'] || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="scope">
            <el-button link @click.stop="showFlowDetail(scope.row)">
              详情
            </el-button>
            <el-button link @click.stop="confirmDeleteFlow(scope.row)" class="delete-btn">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 空状态 -->
      <el-empty v-if="!loading && flows.length === 0" description="暂无流表数据" />
    </el-card>

    <!-- 新增：流表直接操作组件 -->
    <el-card class="direct-operation-card">
      <template #header>
        <div class="page-header">
          <h3>流表直接操作</h3>
          <div class="header-actions">
            <el-radio-group v-model="directOperation.method" size="small">
              <el-radio-button label="GET">GET</el-radio-button>
              <el-radio-button label="PUT">PUT</el-radio-button>
              <el-radio-button label="DELETE">DELETE</el-radio-button>
            </el-radio-group>
          </div>
        </div>
      </template>

      <div class="direct-operation-content">
        <!-- 请求参数 -->
        <div class="request-params">
          <el-form :model="directOperation" label-width="100px" size="small">
            <el-row :gutter="20">
              <el-col :span="8">
                <el-form-item label="设备ID">
                  <el-input 
                    v-model="directOperation.nodeId" 
                    placeholder="例如: openflow:1"
                    clearable
                  />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="表ID">
                  <el-input-number 
                    v-model="directOperation.tableId" 
                    :min="0" 
                    :max="255"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="流表ID">
                  <el-input 
                    v-model="directOperation.flowId" 
                    placeholder="例如: flow-1"
                    clearable
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <!-- PUT方法的请求体 -->
            <el-form-item v-if="directOperation.method === 'PUT'" label="请求体">
              <el-input
                v-model="directOperation.requestBody"
                type="textarea"
                :rows="10"
                placeholder="请输入JSON格式的流表配置"
                class="json-editor"
              />
              <div class="form-tips">
                <el-button size="small" @click="formatJson" type="primary" plain>
                  <el-icon><Document /></el-icon> 格式化JSON
                </el-button>
                <el-button size="small" @click="loadTemplateJson" type="info" plain>
                  <el-icon><CopyDocument /></el-icon> 加载模板
                </el-button>
              </div>
            </el-form-item>

            <!-- 请求URL预览 -->
            <el-form-item label="请求URL">
              <div class="url-preview">
                {{ getRequestUrl() }}
              </div>
            </el-form-item>

            <el-form-item>
              <el-button 
                type="primary" 
                @click="executeOperation" 
                :loading="directOperation.loading"
                :disabled="!isOperationValid"
              >
                执行操作
              </el-button>
              <el-button @click="resetOperation">
                重置
              </el-button>
            </el-form-item>
          </el-form>
        </div>

        <!-- 响应结果 -->
        <div class="response-result" v-if="directOperation.executed">
          <el-divider>响应结果</el-divider>
          
          <div class="response-header">
            <el-tag :type="getResponseStatusType(directOperation.response.status)">
              状态码: {{ directOperation.response.status }}
            </el-tag>
            <span class="response-time">响应时间: {{ directOperation.response.time }}ms</span>
          </div>
          
          <el-tabs v-model="directOperation.activeTab">
            <el-tab-pane label="响应数据" name="data">
              <pre class="response-data">{{ directOperation.response.data }}</pre>
            </el-tab-pane>
            <el-tab-pane label="响应头" name="headers">
              <pre class="response-headers">{{ directOperation.response.headers }}</pre>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>
    </el-card>

    <!-- 流表详情对话框 -->
    <el-dialog
      v-model="showDetailDialog"
      title="流表详情"
      width="800px"
    >
      <div v-if="selectedFlow" class="flow-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="流表ID">
            {{ selectedFlow.id }}
          </el-descriptions-item>
          <el-descriptions-item label="表ID">
            {{ selectedFlow.tableId }}
          </el-descriptions-item>
          <el-descriptions-item label="优先级">
            {{ selectedFlow.priority }}
          </el-descriptions-item>
          <el-descriptions-item label="空闲超时(秒)">
            {{ selectedFlow['idle-timeout'] || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="硬超时(秒)">
            {{ selectedFlow['hard-timeout'] || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="设备ID">
            {{ selectedFlow.nodeId }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 匹配条件 -->
        <div class="flow-section">
          <h4>匹配条件</h4>
          <el-card shadow="never" class="flow-card">
            <pre>{{ JSON.stringify(selectedFlow.match, null, 2) }}</pre>
          </el-card>
        </div>

        <!-- 动作 -->
        <div class="flow-section">
          <h4>动作</h4>
          <el-card shadow="never" class="flow-card">
            <pre>{{ JSON.stringify(selectedFlow.instructions, null, 2) }}</pre>
          </el-card>
        </div>
      </div>
    </el-dialog>

    <!-- 添加流表对话框 -->
    <el-dialog
      v-model="showAddDialog"
      title="添加流表"
      width="800px"
    >
      <el-form :model="newFlow" label-width="120px">
        <el-form-item label="流表ID">
          <el-input v-model="newFlow.id" placeholder="例如: flow-1" />
        </el-form-item>
        <el-form-item label="表ID">
          <el-input-number v-model="newFlow['table_id']" :min="0" :max="255" />
        </el-form-item>
        <el-form-item label="优先级">
          <el-input-number v-model="newFlow.priority" :min="0" :max="65535" />
        </el-form-item>
        <el-form-item label="空闲超时(秒)">
          <el-input-number v-model="newFlow['idle-timeout']" :min="0" />
        </el-form-item>
        <el-form-item label="硬超时(秒)">
          <el-input-number v-model="newFlow['hard-timeout']" :min="0" />
        </el-form-item>

        <!-- 匹配条件 -->
        <el-form-item label="匹配条件">
          <el-card shadow="hover" class="flow-card">
            <el-form-item label="入端口">
              <el-input v-model="matchFields.inPort" placeholder="例如: 1" />
            </el-form-item>
            <el-form-item label="源MAC地址">
              <el-input v-model="matchFields.ethSrc" placeholder="例如: 00:00:00:00:00:01" />
            </el-form-item>
            <el-form-item label="目的MAC地址">
              <el-input v-model="matchFields.ethDst" placeholder="例如: 00:00:00:00:00:02" />
            </el-form-item>
            <el-form-item label="以太网类型">
              <el-select v-model="matchFields.ethType" placeholder="选择类型">
                <el-option label="IPv4 (0x0800)" value="2048" />
                <el-option label="ARP (0x0806)" value="2054" />
                <el-option label="IPv6 (0x86DD)" value="34525" />
              </el-select>
            </el-form-item>
            <el-form-item label="源IP地址">
              <el-input v-model="matchFields.ipv4Src" placeholder="例如: 192.168.1.1/24" />
            </el-form-item>
            <el-form-item label="目的IP地址">
              <el-input v-model="matchFields.ipv4Dst" placeholder="例如: 192.168.1.2/24" />
            </el-form-item>
          </el-card>
        </el-form-item>

        <!-- 动作 -->
        <el-form-item label="动作">
          <el-card shadow="hover" class="flow-card">
            <el-form-item label="动作类型">
              <el-select v-model="actionFields.type" placeholder="选择动作类型">
                <el-option label="输出到端口" value="output" />
                <el-option label="发送到控制器" value="controller" />
                <el-option label="丢弃" value="drop" />
                <el-option label="泛洪" value="flood" />
              </el-select>
            </el-form-item>
            <el-form-item label="输出端口" v-if="actionFields.type === 'output'">
              <el-input v-model="actionFields.outputPort" placeholder="例如: 2 或 NORMAL" />
            </el-form-item>
          </el-card>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showAddDialog = false">取消</el-button>
          <el-button type="primary" @click="addFlow" :loading="submitting">
            确认添加
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Document, CopyDocument } from '@element-plus/icons-vue'
import { flowService } from '../../services/flow.js'
import { deviceService } from '../../services/device.js'
import { API_ENDPOINTS } from '../../utils/constants.js'
import apiClient from '../../services/api.js'
import axios from 'axios'

const route = useRoute()

// 响应式数据
const devices = ref([])
const flows = ref([])
const loading = ref(false)
const submitting = ref(false)
const searchText = ref('')
const selectedNodeId = ref('')
const showDetailDialog = ref(false)
const showAddDialog = ref(false)
const selectedFlow = ref(null)

// 新流表数据
const newFlow = ref({
  id: `flow-${Date.now()}`,
  'table_id': 0,
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
})

// 匹配字段
const matchFields = ref({
  inPort: '',
  ethSrc: '',
  ethDst: '',
  ethType: '',
  ipv4Src: '',
  ipv4Dst: ''
})

// 动作字段
const actionFields = ref({
  type: 'output',
  outputPort: 'NORMAL'
})

// 计算属性
const filteredFlows = computed(() => {
  if (!searchText.value) return flows.value
  return flows.value.filter(flow => 
    flow.id.toLowerCase().includes(searchText.value.toLowerCase()) ||
    parseMatch(flow.match).toLowerCase().includes(searchText.value.toLowerCase()) ||
    parseActions(flow.instructions).toLowerCase().includes(searchText.value.toLowerCase())
  )
})

const activeFlows = computed(() => {
  return flows.value.filter(flow => flow['idle-timeout'] > 0 || flow['hard-timeout'] > 0).length
})

// 加载设备列表
const loadDevices = async () => {
  try {
    const deviceList = await deviceService.getDevices()
    devices.value = deviceList.filter(device => device.type === 'switch')
    
    if (devices.value.length === 0) {
      // 使用模拟数据
      devices.value = [
        { id: 'openflow:1', name: 'Switch-1', type: 'switch' },
        { id: 'openflow:2', name: 'Switch-2', type: 'switch' },
        { id: 'openflow:3', name: 'Switch-3', type: 'switch' }
      ]
    }
    
    // 如果URL中有nodeId参数，则选中对应设备
    const nodeId = route.query.nodeId
    if (nodeId) {
      selectedNodeId.value = nodeId
      await loadFlows()
    } else if (devices.value.length > 0) {
      selectedNodeId.value = devices.value[0].id
      await loadFlows()
    }
  } catch (error) {
    console.error('加载设备失败:', error)
    ElMessage.error('加载设备失败：' + error.message)
  }
}

// 加载流表
const loadFlows = async () => {
  if (!selectedNodeId.value) return
  
  loading.value = true
  try {
    const flowList = await flowService.getFlows(selectedNodeId.value)
    flows.value = flowList
    
    if (flows.value.length === 0) {
      // 使用模拟数据
      flows.value = [
        {
          id: 'flow-1',
          tableId: 0,
          priority: 100,
          'idle-timeout': 300,
          'hard-timeout': 0,
          nodeId: selectedNodeId.value,
          match: {
            'in-port': '1',
            'ethernet-match': {
              'ethernet-source': {
                'address': '00:00:00:00:00:01'
              }
            }
          },
          instructions: {
            instruction: [
              {
                order: 0,
                'apply-actions': {
                  action: [
                    {
                      order: 0,
                      output: {
                        'output-node-connector': '2',
                        'max-length': 65535
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        {
          id: 'flow-2',
          tableId: 0,
          priority: 200,
          'idle-timeout': 0,
          'hard-timeout': 0,
          nodeId: selectedNodeId.value,
          match: {
            'ethernet-match': {
              'ethernet-type': {
                'type': 2048
              }
            },
            'ipv4-destination': '192.168.1.1/24'
          },
          instructions: {
            instruction: [
              {
                order: 0,
                'apply-actions': {
                  action: [
                    {
                      order: 0,
                      'controller-action': {}
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    }
    
    ElMessage.success(`加载完成：${flows.value.length}条流表`)
  } catch (error) {
    console.error('加载流表失败:', error)
    ElMessage.error('加载流表失败：' + error.message)
  } finally {
    loading.value = false
  }
}

// 刷新流表
const refreshFlows = () => {
  loadFlows()
}

// 显示流表详情
const showFlowDetail = (flow) => {
  selectedFlow.value = flow
  showDetailDialog.value = true
}

// 显示添加流表对话框
const showAddFlowDialog = () => {
  if (!selectedNodeId.value) {
    ElMessage.warning('请先选择一个设备')
    return
  }
  
  // 重置表单
  newFlow.value = flowService.generateFlowTemplate(selectedNodeId.value, 0)
  matchFields.value = {
    inPort: '',
    ethSrc: '',
    ethDst: '',
    ethType: '',
    ipv4Src: '',
    ipv4Dst: ''
  }
  actionFields.value = {
    type: 'output',
    outputPort: 'NORMAL'
  }
  
  showAddDialog.value = true
}

// 添加流表
const addFlow = async () => {
  // 构建匹配条件
  const match = {}
  
  if (matchFields.value.inPort) {
    match['in-port'] = matchFields.value.inPort
  }
  
  const ethMatch = {}
  if (matchFields.value.ethSrc) {
    ethMatch['ethernet-source'] = {
      'address': matchFields.value.ethSrc
    }
  }
  
  if (matchFields.value.ethDst) {
    ethMatch['ethernet-destination'] = {
      'address': matchFields.value.ethDst
    }
  }
  
  if (matchFields.value.ethType) {
    ethMatch['ethernet-type'] = {
      'type': parseInt(matchFields.value.ethType)
    }
  }
  
  if (Object.keys(ethMatch).length > 0) {
    match['ethernet-match'] = ethMatch
  }
  
  if (matchFields.value.ipv4Src) {
    match['ipv4-source'] = matchFields.value.ipv4Src
  }
  
  if (matchFields.value.ipv4Dst) {
    match['ipv4-destination'] = matchFields.value.ipv4Dst
  }
  
  newFlow.value.match = match
  
  // 构建动作
  const action = {
    order: 0
  }
  
  switch (actionFields.value.type) {
    case 'output':
      action.output = {
        'output-node-connector': actionFields.value.outputPort,
        'max-length': 65535
      }
      break
    case 'controller':
      action['controller-action'] = {}
      break
    case 'drop':
      action.drop = {}
      break
    case 'flood':
      action['flood-action'] = {}
      break
  }
  
  newFlow.value.instructions = {
    instruction: [
      {
        order: 0,
        'apply-actions': {
          action: [action]
        }
      }
    ]
  }
  
  submitting.value = true
  try {
    await flowService.createFlow(
      selectedNodeId.value,
      newFlow.value['table_id'],
      newFlow.value
    )
    
    ElMessage.success('流表添加成功')
    showAddDialog.value = false
    await loadFlows()
  } catch (error) {
    console.error('添加流表失败:', error)
    ElMessage.error('添加流表失败：' + error.message)
  } finally {
    submitting.value = false
  }
}

// 确认删除流表
const confirmDeleteFlow = (flow) => {
  ElMessageBox.confirm(
    `确定要删除流表 ${flow.id} 吗？`,
    '删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      // 使用直接的URL而不是通过flowService.deleteFlow
      const url = `http://192.168.233.128:8181/restconf/config/opendaylight-inventory:nodes/node/${flow.nodeId}/flow-node-inventory:table/${flow.tableId}/flow/${encodeURIComponent(flow.id)}`
      
      await axios.delete(url, {
        auth: {
          username: 'admin',
          password: 'admin'
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
      
      ElMessage.success('流表删除成功')
      await loadFlows()
    } catch (error) {
      console.error('删除流表失败:', error)
      let errorMsg = '删除流表失败'
      if (error.response) {
        if (error.response.status === 404) {
          errorMsg += '：流表不存在或已被删除'
        } else {
          errorMsg += `：${error.message} (状态码: ${error.response.status})`
        }
      } else {
        errorMsg += `：${error.message}`
      }
      ElMessage.error(errorMsg)
    }
  }).catch(() => {})
}

// 解析匹配条件
const parseMatch = (match) => {
  return flowService.parseMatch(match)
}

// 解析动作
const parseActions = (instructions) => {
  return flowService.parseActions(instructions)
}

// 监听路由参数变化
watch(() => route.query.nodeId, (newNodeId) => {
  if (newNodeId) {
    selectedNodeId.value = newNodeId
    loadFlows()
  }
})

// 组件挂载
onMounted(() => {
  loadDevices()
})

// 新增：直接操作流表相关的数据和方法
const directOperation = ref({
  method: 'GET',
  nodeId: '',
  tableId: 0,
  flowId: '',
  requestBody: '',
  loading: false,
  executed: false,
  activeTab: 'data',
  response: {
    status: null,
    data: null,
    headers: null,
    time: null
  }
})

// 计算属性：操作是否有效
const isOperationValid = computed(() => {
  const { method, nodeId, tableId, flowId, requestBody } = directOperation.value
  
  // 所有操作都需要节点ID
  if (!nodeId) return false
  
  // GET和DELETE操作需要流表ID
  if ((method === 'GET' || method === 'DELETE') && !flowId) return false
  
  // PUT操作需要流表ID和有效的JSON请求体
  if (method === 'PUT') {
    if (!flowId) return false
    if (!requestBody) return false
    try {
      JSON.parse(requestBody)
    } catch (e) {
      return false
    }
  }
  
  return true
})

// 获取请求URL
const getRequestUrl = () => {
  const { method, nodeId, tableId, flowId } = directOperation.value
  if (!nodeId) return '请输入设备ID'
  
  return `http://192.168.233.128:8181/restconf/config/opendaylight-inventory:nodes/node/${nodeId}/flow-node-inventory:table/${tableId}/flow/${encodeURIComponent(flowId || '')}`
}

// 格式化JSON
const formatJson = () => {
  try {
    const parsed = JSON.parse(directOperation.value.requestBody)
    directOperation.value.requestBody = JSON.stringify(parsed, null, 2)
  } catch (e) {
    ElMessage.error('JSON格式错误，无法格式化')
  }
}

// 加载模板JSON
const loadTemplateJson = () => {
  const { nodeId, tableId, flowId } = directOperation.value
  
  // 创建与OpenDaylight Carbon版本兼容的流表模板
  const flowTemplate = {
    "id": flowId || `flow-${Date.now()}`,
    "priority": 20,
    "table_id": tableId || 0,
    "match": {
      "ip-match": {
        "ip-protocol": 1,
        "ip-proto": "ipv4"
      },
      "ipv4-source": "10.0.0.1/32",
      "ipv4-destination": "10.0.0.2/32",
      "ethernet-match": {
        "ethernet-type": {
          "type": 2048
        }
      }
    },
    "instructions": {
      "instruction": [
        {
          "order": 0,
          "apply-actions": {
            "action": [
              {
                "order": 0,
                "drop-action": {}
              }
            ]
          }
        }
      ]
    },
    "idle-timeout": 0,
    "hard-timeout": 0
  }
  
  // 设置请求体为包含flow数组的对象
  directOperation.value.requestBody = JSON.stringify({ flow: [flowTemplate] }, null, 2)
}

// 执行操作
const executeOperation = async () => {
  const { method, nodeId, tableId, flowId, requestBody } = directOperation.value
  
  // 使用直接的URL而不是通过API_ENDPOINTS构建
  const url = `http://192.168.233.128:8181/restconf/config/opendaylight-inventory:nodes/node/${nodeId}/flow-node-inventory:table/${tableId}/flow/${encodeURIComponent(flowId)}`
  
  directOperation.value.loading = true
  directOperation.value.executed = false
  
  const startTime = Date.now()
  
  try {
    let response
    
    switch (method) {
      case 'GET':
        response = await axios.get(url, {
          auth: {
            username: 'admin',
            password: 'admin'
          },
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        })
        break
      case 'PUT':
        response = await axios.put(url, JSON.parse(requestBody), {
          auth: {
            username: 'admin',
            password: 'admin'
          },
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        })
        break
      case 'DELETE':
        response = await axios.delete(url, {
          auth: {
            username: 'admin',
            password: 'admin'
          },
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        })
        break
    }
    
    const endTime = Date.now()
    
    directOperation.value.response = {
      status: response.status,
      data: JSON.stringify(response.data, null, 2),
      headers: JSON.stringify(response.headers, null, 2),
      time: endTime - startTime
    }
    
    directOperation.value.executed = true
    ElMessage.success(`${method}操作成功`)
    
    // 如果是修改或删除操作，刷新流表列表
    if (method === 'PUT' || method === 'DELETE') {
      if (nodeId === selectedNodeId.value) {
        await loadFlows()
      }
    }
  } catch (error) {
    const endTime = Date.now()
    
    directOperation.value.response = {
      status: error.response?.status || 500,
      data: JSON.stringify(error.response?.data || { error: error.message }, null, 2),
      headers: JSON.stringify(error.response?.headers || {}, null, 2),
      time: endTime - startTime
    }
    
    directOperation.value.executed = true
    ElMessage.error(`${method}操作失败: ${error.message}`)
  } finally {
    directOperation.value.loading = false
  }
}

// 重置操作
const resetOperation = () => {
  directOperation.value = {
    method: 'GET',
    nodeId: '',
    tableId: 0,
    flowId: '',
    requestBody: '',
    loading: false,
    executed: false,
    activeTab: 'data',
    response: {
      status: null,
      data: null,
      headers: null,
      time: null
    }
  }
}

// 获取响应状态类型
const getResponseStatusType = (status) => {
  if (!status) return 'info'
  if (status >= 200 && status < 300) return 'success'
  if (status >= 300 && status < 400) return 'warning'
  return 'danger'
}
</script>

<style scoped>
.flow-tables-page {
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

/* 新增样式 */
.direct-operation-card {
  margin-top: 20px;
}

.direct-operation-content {
  padding: 10px 0;
}

.url-preview {
  background-color: #f8f9fa;
  padding: 8px 12px;
  border-radius: 4px;
  font-family: monospace;
  word-break: break-all;
}

.json-editor {
  font-family: monospace;
}

.form-tips {
  margin-top: 10px;
  display: flex;
  gap: 10px;
}

.response-result {
  margin-top: 20px;
}

.response-header {
  margin-bottom: 15px;
  display: flex;
  align-items: center;
}

.response-time {
  margin-left: 15px;
  color: #909399;
  font-size: 14px;
}

.response-data,
.response-headers {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
}

/* 保留原有样式 */
.flow-stats {
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

.flow-detail {
  padding: 20px;
}

.flow-section {
  margin-top: 20px;
}

.flow-section h4 {
  margin-bottom: 15px;
  color: #303133;
}

.flow-card {
  margin-bottom: 15px;
}

.flow-card pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.el-table {
  cursor: pointer;
}

.el-table :deep(.el-table__row:hover) {
  background-color: #f5f7fa;
}

.delete-btn {
  color: #F56C6C;
}
</style>