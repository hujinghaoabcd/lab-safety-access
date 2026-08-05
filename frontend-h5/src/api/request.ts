import axios from 'axios'
import type { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { showToast, showLoadingToast, closeToast } from 'vant'

interface ApiResponse<T = unknown> {
  code: number
  message?: string
  data: T
}

const service: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

service.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error: AxiosError) => Promise.reject(error)
)

service.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const payload = response.data
    if (payload.code !== 0 && payload.code !== 200) {
      showToast({
        message: payload.message || '请求失败',
        type: 'fail'
      })

      if (payload.code === 401) {
        const url = response.config?.url || ''
        if (!url.includes('/auth/login')) {
          localStorage.removeItem('token')
          window.location.href = '/login'
        }
      }

      return Promise.reject(new Error(payload.message || '请求失败'))
    }
    return payload
  },
  (unknownError: unknown) => {
    const requestError = unknownError as AxiosError<ApiResponse>
    console.error('Request error:', requestError)

    const status = requestError.response?.status
    const payload = requestError.response?.data
    const message = payload?.message || requestError.message || '网络错误'
    const url = requestError.config?.url || ''

    if (status === 401) {
      if (url.includes('/auth/login')) {
        showToast({ message, type: 'fail' })
        return Promise.reject(new Error(message))
      }

      localStorage.removeItem('token')
      showToast({ message: '登录已过期，请重新登录', type: 'fail' })
      setTimeout(() => {
        window.location.href = '/login'
      }, 1000)
      return Promise.reject(new Error('登录已过期，请重新登录'))
    }

    showToast({ message, type: 'fail' })
    return Promise.reject(requestError)
  }
)

// The response interceptor returns the API envelope rather than AxiosResponse.
// Axios's second generic parameter declares that runtime return type.
export const request = {
  get<T = ApiResponse>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return service.get<T, T>(url, config)
  },

  post<T = ApiResponse>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return service.post<T, T, unknown>(url, data, config)
  },

  put<T = ApiResponse>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return service.put<T, T, unknown>(url, data, config)
  },

  delete<T = ApiResponse>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return service.delete<T, T>(url, config)
  }
}

export const requestWithLoading = {
  async get<T = ApiResponse>(url: string, config?: AxiosRequestConfig): Promise<T> {
    showLoadingToast({ message: '加载中...', forbidClick: true })
    try {
      return await request.get<T>(url, config)
    } finally {
      closeToast()
    }
  },

  async post<T = ApiResponse>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    showLoadingToast({ message: '提交中...', forbidClick: true })
    try {
      return await request.post<T>(url, data, config)
    } finally {
      closeToast()
    }
  }
}

export default service
