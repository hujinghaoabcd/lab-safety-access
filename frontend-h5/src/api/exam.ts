import { request } from './request'

// 获取考试列表
export function getExamList() {
  return request.get('/exam/list')
}

// 获取单个考试详情
export function getExamDetail(id: string | number) {
  return request.get(`/exam/${id}`)
}

// 开始考试
export function startExam(examId: string) {
  return request.post('/exam/start', { examId })
}

// 提交考试答案
export function submitExam(
  examId: string,
  answers: Record<string, string | string[]>,
  duration?: string
) {
  return request.post('/exam/submit', { examId, answers, duration })
}

// 获取考试记录列表
export function getRecordsList() {
  return request.get('/records/list')
}

// 获取考试记录详情
export function getRecordDetail(id: string) {
  return request.get(`/records/${id}`)
}

// 获取错题本
export function getWrongBook() {
  return request.get('/wrongbook/list')
}

// 删除一条错题（题目 ID）
export function removeWrongQuestion(id: string | number) {
  return request.delete(`/wrongbook/${id}`)
}

// 获取准入状态
export function getQualification() {
  return request.get('/qualification/status')
}

// 获取当前用户的证书列表
export function getMyCertificates() {
  return request.get('/qualification/certificate')
}

// 获取成绩排行榜
export function getRanking() {
  return request.get('/records/ranking')
}

