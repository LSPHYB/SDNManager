// 认证服务
export const authService = {
  // 默认账户信息
  defaultCredentials: {
    username: 'admin',
    password: 'admin'
  },

  // 登录验证
  login(username, password) {
    return new Promise((resolve, reject) => {
      // 模拟异步登录过程
      setTimeout(() => {
        if (username === this.defaultCredentials.username && 
            password === this.defaultCredentials.password) {
          // 登录成功，保存token到localStorage
          const token = 'sdn-admin-token-' + Date.now()
          localStorage.setItem('sdn_token', token)
          localStorage.setItem('sdn_user', JSON.stringify({
            username: username,
            loginTime: new Date().toISOString()
          }))
          resolve({ success: true, token, username })
        } else {
          reject({ success: false, message: '用户名或密码错误' })
        }
      }, 500)
    })
  },

  // 退出登录
  logout() {
    localStorage.removeItem('sdn_token')
    localStorage.removeItem('sdn_user')
    return Promise.resolve()
  },

  // 检查是否已登录
  isAuthenticated() {
    const token = localStorage.getItem('sdn_token')
    return !!token
  },

  // 获取当前用户信息
  getCurrentUser() {
    const userStr = localStorage.getItem('sdn_user')
    return userStr ? JSON.parse(userStr) : null
  },

  // 获取token
  getToken() {
    return localStorage.getItem('sdn_token')
  }
}