import axios from 'axios'

// 修正API基础URL - 开发环境不需要/restconf前缀，因为代理会处理
const API_BASE_URL = import.meta.env.DEV ? '' : 'http://192.168.233.128:8181'
const USERNAME = 'admin'
const PASSWORD = 'admin'

// 创建axios实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})

// 在所有环境都添加认证
apiClient.defaults.auth = {
  username: USERNAME,
  password: PASSWORD
}

// 请求拦截器
apiClient.interceptors.request.use(
  config => {
    console.log('发送请求:', config.method?.toUpperCase(), config.url)
    return config
  },
  error => {
    console.error('请求错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
apiClient.interceptors.response.use(
  response => {
    console.log('收到响应:', response.status, response.config.url)
    return response
  },
  error => {
    console.error('响应错误:', error.response?.status, error.message)
    if (error.response?.status === 401) {
      console.error('认证失败，请检查用户名和密码')
    } else if (error.response?.status === 404) {
      console.error('API端点不存在')
    } else if (error.code === 'ECONNREFUSED') {
      console.error('无法连接到OpenDaylight控制器，请确保控制器正在运行')
    }
    return Promise.reject(error)
  }
)

export { apiClient }
export default apiClient