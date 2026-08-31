import axios from 'axios'
import type { AxiosError, AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'
import { clearAdminSession, markAdminSession } from '@/utils/session'

interface ApiEnvelope<T = unknown> {
  code: number
  message?: string
  data: T
}

// Remove credentials left by the old localStorage authentication flow.
localStorage.removeItem('admin_token')

// The response interceptor intentionally returns the API payload rather than
// AxiosResponse. Existing administrator API functions therefore expose the
// decoded payload while the interceptor callbacks themselves stay typed.
const request: any = axios.create({
  baseURL: '/api',
  timeout: 10000,
  withCredentials: true
})

request.interceptors.response.use(
  (response: AxiosResponse<ApiEnvelope>) => {
    const payload = response.data
    if (payload.code === 0) {
      if (response.config?.url?.includes('/admin/login')) {
        markAdminSession(true)
        // Existing LoginPage only uses `res.token` as a presence marker. Keep
        // that UI contract without exposing the real JWT to JavaScript.
        return { ...(payload.data as object), token: 'cookie-session' }
      }
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

      clearAdminSession()
      router.replace('/login')
      ElMessage.error('登录已过期，请重新登录')
      return Promise.reject(new Error('登录已过期，请重新登录'))
    }

    ElMessage.error(message)
    return Promise.reject(new Error(message))
  }
)

export default request
