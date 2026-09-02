export * from './auth'
export * from './learning'
export * from './exam'
import { request } from './request'

// 跑马灯和公告
export function getBanners() {
  return request.get('/banner/list')
}

export function getAnnouncement(options?: { all?: boolean }) {
  return request.get('/announcement/current', {
    params: options?.all ? { all: 1 } : undefined
  })
}
