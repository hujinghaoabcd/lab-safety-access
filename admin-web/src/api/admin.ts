import request from './request'

// 登录
export const login = (data: { username: string; password: string }) => {
  return request.post('/admin/login', data)
}

// 仪表盘
export const getDashboardStats = () => {
  return request.get('/admin/dashboard/stats')
}

export const getChartData = () => {
  return request.get('/admin/dashboard/chart')
}

export const getRecentExams = () => {
  return request.get('/admin/dashboard/recent-exams')
}

// 用户管理
export const getUsers = (params?: Record<string, any>) => {
  return request.get('/admin/users', { params })
}

export const createUser = (data: Record<string, any>) => {
  return request.post('/admin/users', data)
}

export const updateUser = (id: number, data: Record<string, any>) => {
  return request.put(`/admin/users/${id}`, data)
}

export const deleteUser = (id: number) => {
  return request.delete(`/admin/users/${id}`)
}

export const toggleUserStatus = (id: number) => {
  return request.put(`/admin/users/${id}/status`)
}

export const resetUserPassword = (id: number) => {
  return request.put(`/admin/users/${id}/reset-password`)
}

export const batchDeleteUsers = (ids: number[]) => {
  return request.post('/admin/users/batch-delete', { ids })
}

export const batchImportUsers = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/admin/users/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

// 考试管理
export const getExams = (params?: Record<string, any>) => {
  return request.get('/admin/exams', { params })
}

export const createExam = (data: Record<string, any>) => {
  return request.post('/admin/exams', data)
}

export const updateExam = (id: number, data: Record<string, any>) => {
  return request.put(`/admin/exams/${id}`, data)
}

export const deleteExam = (id: number) => {
  return request.delete(`/admin/exams/${id}`)
}

export const toggleExamStatus = (id: number) => {
  return request.put(`/admin/exams/${id}/status`)
}

export const getExamAssignments = (id: number) => {
  return request.get(`/admin/exams/${id}/assignments`)
}

export const updateExamAssignments = (id: number, assignments: any) => {
  return request.put(`/admin/exams/${id}/assignments`, { assignments })
}

export const getExamQuestions = (id: number) => {
  return request.get(`/admin/exams/${id}/questions`)
}

export const configExamQuestions = (id: number, data: { addIds?: number[], removeIds?: number[] }) => {
  return request.post(`/admin/exams/${id}/questions/config`, data)
}

export const autoSelectQuestions = (id: number) => {
  return request.post(`/admin/exams/${id}/questions/auto-select`)
}

// 题库管理
export const getQuestions = (params?: Record<string, any>) => {
  return request.get('/admin/questions', { params })
}

export const createQuestion = (data: Record<string, any>) => {
  return request.post('/admin/questions', data)
}

export const updateQuestion = (id: number, data: Record<string, any>) => {
  return request.put(`/admin/questions/${id}`, data)
}

export const deleteQuestion = (id: number) => {
  return request.delete(`/admin/questions/${id}`)
}

export const batchDeleteQuestions = (ids: number[]) => {
  return request.post('/admin/questions/batch-delete', { ids })
}

export const importQuestions = (data: FormData) => {
  return request.post('/admin/questions/import', data)
}

export const exportQuestions = (params?: Record<string, any>) => {
  return request.get('/admin/questions/export', { params })
}

// 考试记录
export const getRecords = (params?: Record<string, any>) => {
  return request.get('/admin/records', { params })
}

export const getRecordDetail = (id: number) => {
  return request.get(`/admin/records/${id}`)
}

export const exportRecords = (params?: Record<string, any>) => {
  return request.get('/admin/records/export', { params })
}

export const deleteRecord = (id: number) => {
  return request.delete(`/admin/records/${id}`)
}

// 证书管理
export const getCertificates = (params?: Record<string, any>) => {
  return request.get('/admin/certificates', { params })
}

export const revokeCertificate = (id: number) => {
  return request.put(`/admin/certificates/${id}/revoke`)
}

export const reissueCertificate = (id: number) => {
  return request.put(`/admin/certificates/${id}/reissue`)
}

export const exportCertificates = (params?: Record<string, any>) => {
  return request.get('/admin/certificates/export', { params })
}

export const issueCertificate = (data: { userId: number; examId: number; score?: number; grade?: string }) => {
  return request.post('/admin/certificates', data)
}

// 系统设置
export const getSettings = () => {
  return request.get('/admin/settings')
}

export const updateSettings = (type: string, data: Record<string, any>) => {
  return request.put('/admin/settings', { type, data })
}

// 院系/班级管理
export const getDepartments = (params?: Record<string, any>) => {
  return request.get('/admin/departments', { params })
}

export const createDepartment = (data: { name: string }) => {
  return request.post('/admin/departments', data)
}

export const updateDepartment = (id: number, data: { name: string }) => {
  return request.put(`/admin/departments/${id}`, data)
}

export const deleteDepartment = (id: number) => {
  return request.delete(`/admin/departments/${id}`)
}

export const getClasses = (params?: Record<string, any>) => {
  return request.get('/admin/classes', { params })
}

export const createClass = (data: { departmentId: number; name: string }) => {
  return request.post('/admin/classes', data)
}

export const updateClass = (id: number, data: { departmentId: number; name: string }) => {
  return request.put(`/admin/classes/${id}`, data)
}

export const deleteClass = (id: number) => {
  return request.delete(`/admin/classes/${id}`)
}

// 数据库维护（超级管理员）
export const backupAndClearDb = () => {
  return request.post('/admin/db/backup-clear')
}

export const restoreDb = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/admin/db/restore', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

// 跑马灯管理
export const getBanners = (params?: Record<string, any>) => {
  return request.get('/admin/banner', { params })
}

export const createBanner = (data: { title: string; subtitle?: string; color?: string; orderNum?: number; status?: number }) => {
  return request.post('/admin/banner', data)
}

export const updateBanner = (id: number, data: { title?: string; subtitle?: string; color?: string; orderNum?: number; status?: number }) => {
  return request.put(`/admin/banner/${id}`, data)
}

export const deleteBanner = (id: number) => {
  return request.delete(`/admin/banner/${id}`)
}

// 公告管理
export const getAnnouncements = (params?: Record<string, any>) => {
  return request.get('/admin/announcement', { params })
}

export const createAnnouncement = (data: { content: string; orderNum?: number; status?: number }) => {
  return request.post('/admin/announcement', data)
}

export const updateAnnouncement = (id: number, data: { content?: string; orderNum?: number; status?: number }) => {
  return request.put(`/admin/announcement/${id}`, data)
}

export const deleteAnnouncement = (id: number) => {
  return request.delete(`/admin/announcement/${id}`)
}

// 学习资料管理
export const getLearningMaterials = (params?: Record<string, any>) => {
  return request.get('/admin/learning-materials', { params })
}

export const createLearningMaterial = (data: { title: string; description?: string; content: string; duration?: string; category?: string; orderNum?: number }) => {
  return request.post('/admin/learning-materials', data)
}

export const updateLearningMaterial = (id: number, data: { title?: string; description?: string; content?: string; duration?: string; category?: string; orderNum?: number }) => {
  return request.put(`/admin/learning-materials/${id}`, data)
}

export const deleteLearningMaterial = (id: number) => {
  return request.delete(`/admin/learning-materials/${id}`)
}

export const batchDeleteLearningMaterials = (ids: number[]) => {
  return request.post('/admin/learning-materials/batch-delete', { ids })
}

