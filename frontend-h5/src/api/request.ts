import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { showToast, showLoadingToast, closeToast } from 'vant'

// 创建 axios 实例
const service: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
service.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
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
service.interceptors.response.use(
  (response: AxiosResponse) => {
    const res = response.data
    
    // 假设后端返回格式为 { code: 0, data: any, message: string }
    if (res.code !== 0 && res.code !== 200) {
      showToast({
        message: res.message || '请求失败',
        type: 'fail'
      })
      
      // token 过期（业务层面的 401）
      if (res.code === 401) {
        // 如果是登录接口，不跳转，只显示错误
        const url = response.config?.url || ''
        if (!url.includes('/auth/login')) {
          localStorage.removeItem('token')
          window.location.href = '/login'
        }
      }
      
      return Promise.reject(new Error(res.message || 'Error'))
    }
    
    return res
  },
  (error) => {
    console.error('Request error:', error)
    
    // 处理 HTTP 状态码错误
    const status = error.response?.status
    const res = error.response?.data
    const message = res?.message || error.message || '网络错误'
    const url = error.config?.url || ''
    
    // HTTP 401 错误
    if (status === 401) {
      // 如果是登录接口，只显示错误信息，不跳转
      if (url.includes('/auth/login')) {
        showToast({
          message: message || '用户名或密码错误',
          type: 'fail'
        })
        return Promise.reject(new Error(message || '用户名或密码错误'))
      } else {
        // 其他接口的 401，说明 token 过期
        localStorage.removeItem('token')
        showToast({
          message: '登录已过期，请重新登录',
          type: 'fail'
        })
        // 延迟跳转，让用户看到提示
        setTimeout(() => {
          window.location.href = '/login'
        }, 1000)
        return Promise.reject(new Error('登录已过期，请重新登录'))
      }
    }
    
    // 其他 HTTP 错误
    showToast({
      message: message,
      type: 'fail'
    })
    return Promise.reject(error)
  }
)

// 封装请求方法
export const request = {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return service.get(url, config)
  },
  
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return service.post(url, data, config)
  },
  
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return service.put(url, data, config)
  },
  
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return service.delete(url, config)
  }
}

// 带 loading 的请求
export const requestWithLoading = {
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    showLoadingToast({ message: '加载中...', forbidClick: true })
    try {
      const res = await request.get<T>(url, config)
      return res
    } finally {
      closeToast()
    }
  },
  
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    showLoadingToast({ message: '提交中...', forbidClick: true })
    try {
      const res = await request.post<T>(url, data, config)
      return res
    } finally {
      closeToast()
    }
  }
}

export default service

