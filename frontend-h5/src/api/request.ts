import axios from 'axios'
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'
import { showToast, showLoadingToast } from 'vant'
import { clearStudentSession, isStudentLogoutInProgress } from '@/utils/session'

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
  withCredentials: true
})

let loginRedirectTimer: number | null = null

const endpointUnavailableMessage = (url: string) => {
  if (url.includes('/user/profile/password')) {
    return '修改密码服务暂不可用，请刷新页面后重试'
  }
  if (url.includes('/user/profile/avatar')) {
    return '头像上传服务暂不可用，请刷新页面后重试'
  }
  if (url.includes('/user/profile')) {
    return '个人信息保存服务暂不可用，请刷新页面后重试'
  }
  return '请求的服务暂不可用，请刷新页面后重试'
}

const normalizeRequestError = (
  status: number | undefined,
  rawMessage: string | undefined,
  url: string,
  errorCode?: string
) => {
  const message = String(rawMessage || '').trim()
  const genericAxiosMessage = /^Request failed with status code \d+$/i.test(message)

  if (status === 404 && (!message || genericAxiosMessage || message === 'API 接口不存在')) {
    return endpointUnavailableMessage(url)
  }
  if (status === 413) {
    return url.includes('/user/profile/avatar')
      ? '头像图片过大，请选择 5 MB 以内的图片'
      : '上传文件过大，请选择更小的文件'
  }
  if (errorCode === 'ECONNABORTED' || /timeout/i.test(message)) {
    return '请求超时，请检查网络后重试'
  }
  if (!status && (errorCode === 'ERR_NETWORK' || !message || /network error/i.test(message))) {
    return '网络连接失败，请检查网络后重试'
  }
  return message || '请求失败，请稍后重试'
}

const showRequestError = (message: string) => {
  // 所有失败请求统一使用已经做过 Android WebView 兼容处理的 Vant Toast。
  // 不再为头像上传单独使用原生 alert，保持全站交互一致。
  showToast({
    message,
    type: 'fail'
  })
}

const shouldSuppressAuthRedirect = () => {
  return isStudentLogoutInProgress() || window.location.pathname === '/login'
}

const scheduleLoginRedirect = () => {
  if (shouldSuppressAuthRedirect() || loginRedirectTimer !== null) return

  loginRedirectTimer = window.setTimeout(() => {
    loginRedirectTimer = null
    if (window.location.pathname !== '/login' && !isStudentLogoutInProgress()) {
      window.location.replace('/login')
    }
  }, 700)
}

service.interceptors.response.use(
  (response: AxiosResponse) => {
    const payload = response.data as ApiResponse<unknown>
    if (payload.code !== 0 && payload.code !== 200) {
      const url = response.config?.url || ''
      const message = normalizeRequestError(payload.code, payload.message, url)

      if (payload.code === 401 && !url.includes('/auth/login')) {
        clearStudentSession()
        if (!shouldSuppressAuthRedirect()) {
          showRequestError('登录已过期，请重新登录')
          scheduleLoginRedirect()
        }
        return Promise.reject(new Error(message))
      }

      showRequestError(message)
      return Promise.reject(new Error(message))
    }
    return response
  },
  (unknownError: unknown) => {
    const requestError = unknownError as AxiosError<ApiResponse<unknown>>
    console.error('Request error:', requestError)

    const status = requestError.response?.status
    const payload = requestError.response?.data
    const url = requestError.config?.url || ''
    const message = normalizeRequestError(
      status,
      payload?.message || requestError.message,
      url,
      requestError.code
    )

    if (status === 401) {
      if (url.includes('/auth/login')) {
        showRequestError(message)
        return Promise.reject(new Error(message))
      }

      clearStudentSession()

      // An explicit logout can invalidate several profile/stats requests that
      // were already in flight. Those expected 401s must stay silent and must
      // not hard-reload /login. Repeated location.href redirects were the cause
      // of the login screen flashing and inputs repeatedly losing focus.
      if (shouldSuppressAuthRedirect()) {
        return Promise.reject(new Error('会话已结束'))
      }

      const expiredMessage = '登录已过期，请重新登录'
      showRequestError(expiredMessage)
      scheduleLoginRedirect()
      return Promise.reject(new Error(expiredMessage))
    }

    showRequestError(message)
    // 页面层的 catch 只会拿到整理后的业务错误，不再看到
    // "Request failed with status code 404" 之类 Axios 原始状态文本。
    return Promise.reject(new Error(message))
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
    const loadingToast = showLoadingToast({ message: '加载中...', forbidClick: true })
    try {
      return await request.get<T>(url, config)
    } finally {
      // 只关闭本次 loading 实例，不能使用全局 closeToast()，否则请求失败时
      // response interceptor 刚显示的错误 Toast 会被 finally 立即一起关掉。
      loadingToast.close()
    }
  },

  async post<T = ApiResponse>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const loadingToast = showLoadingToast({ message: '提交中...', forbidClick: true })
    try {
      return await request.post<T>(url, data, config)
    } finally {
      loadingToast.close()
    }
  }
}

export default service
