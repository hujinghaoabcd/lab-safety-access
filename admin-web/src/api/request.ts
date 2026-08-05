import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

// Note: we intentionally loosen the AxiosInstance typing because our response
// interceptor returns `res.data` directly (not AxiosResponse). This keeps all
// `adminApi.xxx()` calls typed as the actual payload shape.
const request: any = axios.create({
  baseURL: '/api',
  timeout: 10000
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.code === 0) {
      return res.data
    } else {
      ElMessage.error(res.message || '请求失败')
      return Promise.reject(new Error(res.message || '请求失败'))
    }
  },
  (error) => {
    const res = error.response?.data
    const message = res?.message || error.message || '网络错误'
    
    if (error.response?.status === 401) {
      // 如果是登录接口，显示登录错误消息
      if (error.config?.url?.includes('/admin/login')) {
        // 登录失败，显示错误消息，不删除 token，不跳转
        ElMessage.error(message)
        return Promise.reject(new Error(message))
      } else {
        // 其他接口 401，说明 token 过期
        localStorage.removeItem('admin_token')
        router.replace('/login')
        ElMessage.error('登录已过期，请重新登录')
        return Promise.reject(new Error('登录已过期，请重新登录'))
      }
    } else {
      // 其他错误，显示后端返回的消息
      ElMessage.error(message)
      return Promise.reject(new Error(message))
    }
  }
)

export default request

