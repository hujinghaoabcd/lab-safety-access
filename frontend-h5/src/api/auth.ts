import { request } from './request'
import { markStudentSession } from '@/utils/session'

export interface LoginParams {
  username: string
  password: string
}

export interface LoginResult {
  code: number
  data: {
    // Non-secret compatibility marker for existing login components. The real
    // JWT is only in the HttpOnly cookie and is never exposed to JavaScript.
    token?: string
    userInfo: {
      id: string
      name: string
      studentId: string
      department: string
      avatar?: string | null
    }
  }
  message: string
}

// 登录：服务端通过 HttpOnly Cookie 建立会话，不向浏览器脚本返回 JWT。
export async function login(params: LoginParams) {
  const response = await request.post<LoginResult>('/auth/login', params)
  markStudentSession(true)
  return {
    ...response,
    data: {
      ...response.data,
      token: 'cookie-session'
    }
  }
}

// 获取用户信息
export function getUserProfile() {
  return request.get('/user/profile')
}

// 更新用户信息
export function updateUserProfile(data: { name?: string; phone?: string; email?: string; department?: string }) {
  return request.put('/user/profile', data)
}

// 获取用户统计数据
export function getUserProfileStats() {
  return request.get('/user/profile/stats')
}

// 修改密码
export function changePassword(data: { oldPassword: string; newPassword: string }) {
  return request.put('/user/profile/password', data)
}

// 上传头像
export function uploadAvatar(file: File) {
  const formData = new FormData()
  formData.append('avatar', file)

  // 不手工指定 multipart/form-data。浏览器必须自行生成带 boundary 的
  // Content-Type；部分 Android WebView 在手工覆盖该请求头时会偶发上传失败。
  // 头像上传单独放宽到 60 秒，避免移动网络/VPN 下大图在全局 30 秒超时。
  return request.post('/user/profile/avatar', formData, {
    timeout: 60000
  })
}

// 退出登录
export function logout() {
  return request.post('/auth/logout')
}
