import axios from 'axios'
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'
import { showToast, showLoadingToast, closeToast } from 'vant'
import { clearStudentSession } from '@/utils/session'

// One-time cleanup for browsers that used the pre-cookie authentication flow.
// This value is no longer read or written anywhere in the API client.
localStorage.removeItem('token')

interface ApiResponse<T = unknown> {
  code: number
  message?: string
  data: T
}

const service = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
})

const isAvatarUpload = (url?: string) => String(url || '').includes('/user/profile/avatar')

const showRequestError = (message: string, url?: string) => {
  // 当前部分 Android 内置 WebView 对 Vant Toast 的合成层偶发渲染成纯白块，
  // 头像上传失败时不能只依赖 Toast，否则用户会感觉“没有任何报错”。
  // 对头像上传使用原生提示框，确保格式、大小、网络等错误一定可见。
  if (isAvatarUpload(url)) {
    window.alert(`头像上传失败：${message}\n\n支持 JPG、PNG、WebP，文件大小不超过 5 MB。`)
    return
  }

  showToast({
    message,
    type: 'fail'
  })
}

service.interceptors.response.use(
  (response: AxiosResponse) => {
    const payload = response.data as ApiResponse<unknown>
    if (payload.code !== 0 && payload.code !== 200) {
      showRequestError(payload.message || '请求失败', response.config?.url)

      if (payload.code === 401) {
        const url = response.config?.url || ''
        if (!url.includes('/auth/login')) {
          clearStudentSession()
          window.location.href = '/login'
        }
      }

      return Promise.reject(new Error(payload.message || '请求失败'))
    }
    return response
  },
  (unknownError: unknown) => {
    const requestError = unknownError as AxiosError<ApiResponse<unknown>>
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

      clearStudentSession()
      showToast({ message: '登录已过期，请重新登录', type: 'fail' })
      setTimeout(() => {
        window.location.href = '/login'
      }, 1000)
      return Promise.reject(new Error('登录已过期，请重新登录'))
    }

    showRequestError(message, url)
    return Promise.reject(requestError)
  }
)

export const request = {
  async get<T = ApiResponse>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await service.get<T>(url, config)
    return response.data
  },

  async post<T = ApiResponse>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await service.post<T>(url, data, config)
    return response.data
  },

  async put<T = ApiResponse>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await service.put<T>(url, data, config)
    return response.data
  },

  async delete<T = ApiResponse>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await service.delete<T>(url, config)
    return response.data
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
