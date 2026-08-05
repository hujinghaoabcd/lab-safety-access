import axios from 'axios'
import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

interface ApiEnvelope<T = unknown> {
  code: number
  message?: string
  data: T
}

// The response interceptor intentionally returns the API payload rather than
// AxiosResponse. Existing administrator API functions therefore expose the
// decoded payload while the interceptor callbacks themselves stay typed.
const request: any = axios.create({
  baseURL: '/api',
  timeout: 10000
})

request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error)
)

request.interceptors.response.use(
  (response: AxiosResponse<ApiEnvelope>) => {
    const payload = response.data
    if (payload.code === 0) {
      return payload.data
    }

    const message = payload.message || '请求失败'
    ElMessage.error(message)
    return Promise.reject(new Error(message))
  },
  (error: AxiosError<ApiEnvelope>) => {
    const payload = error.response?.data
    const message = payload?.message || error.message || '网络错误'

    if (error.response?.status === 401) {
      if (error.config?.url?.includes('/admin/login')) {
        ElMessage.error(message)
        return Promise.reject(new Error(message))
      }

      localStorage.removeItem('admin_token')
      router.replace('/login')
      ElMessage.error('登录已过期，请重新登录')
      return Promise.reject(new Error('登录已过期，请重新登录'))
    }

    ElMessage.error(message)
    return Promise.reject(new Error(message))
  }
)

export default request
