import { request } from './request'

export interface LoginParams {
  username: string
  password: string
}

export interface LoginResult {
  code: number
  data: {
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
export function login(params: LoginParams) {
  return request.post<LoginResult>('/auth/login', params)
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
  return request.post('/user/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

// 退出登录
export function logout() {
  return request.post('/auth/logout')
}
