export * from './auth'
export * from './learning'
export * from './exam'
import { request } from './request'

// 跑马灯和公告
export function getBanners() {
  return request.get('/banner/list')
}

export function getAnnouncement() {
  return request.get('/announcement/current')
}

