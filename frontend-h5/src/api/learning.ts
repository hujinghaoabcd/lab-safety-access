import { request } from './request'

// 获取学习资料列表
export function getLearningList() {
  return request.get('/learning/list')
}

// 获取学习资料详情
export function getLearningDetail(id: string) {
  return request.get(`/learning/${id}`)
}

// 记录学习进度
export function recordProgress(id: string, progress: number) {
  return request.post('/learning/progress', { id, progress })
}

// 记录学习时长（秒）
export function recordStudyTime(id: string, duration: number) {
  return request.post('/learning/duration', { id, duration })
}

// 获取 PDF 代理 URL（解决 CORS 问题）
export function getPdfProxyUrl(pdfUrl: string): string {
  // 使用相对路径，通过 vite 代理或同源请求
  const encodedUrl = encodeURIComponent(pdfUrl)
  return `/api/learning/proxy-pdf?url=${encodedUrl}`
}

