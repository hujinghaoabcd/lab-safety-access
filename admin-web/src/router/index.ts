import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { checkAdminSession, clearAdminSession } from '@/utils/session'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginPage.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/',
    component: () => import('@/layouts/AdminLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/DashboardPage.vue'),
        meta: { title: '首页', icon: 'Odometer' }
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('@/views/UsersPage.vue'),
        meta: { title: '用户管理', icon: 'User' }
      },
      {
        path: 'exams',
        name: 'Exams',
        component: () => import('@/views/ExamsPage.vue'),
        meta: { title: '考试管理', icon: 'Document' }
      },
      {
        path: 'questions',
        name: 'Questions',
        component: () => import('@/views/QuestionsPage.vue'),
        meta: { title: '题库管理', icon: 'Collection' }
      },
      {
        path: 'records',
        name: 'Records',
        component: () => import('@/views/RecordsPage.vue'),
        meta: { title: '考试记录', icon: 'Tickets' }
      },
      {
        path: 'certificates',
        name: 'Certificates',
        component: () => import('@/views/CertificatesPage.vue'),
        meta: { title: '证书管理', icon: 'Medal' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/SettingsPage.vue'),
        meta: { title: '系统设置', icon: 'Setting' }
      },
      {
        path: 'management',
        name: 'Management',
        component: () => import('@/views/ManagementPage.vue'),
        meta: { title: '班级管理', icon: 'OfficeBuilding' }
      },
      {
        path: 'learning-materials',
        name: 'LearningMaterials',
        component: () => import('@/views/LearningMaterialsPage.vue'),
        meta: { title: '资料管理', icon: 'Reading' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach(async (to, from) => {
  document.title = `${to.meta.title || '后台管理'} - 实验室安全教育考试系统`

  // Navigating to the login screen is also the canonical logout path used by
  // the existing layout. Clear the HttpOnly cookie server-side; no browser
  // token is needed to decide whether an admin route is protected.
  if (to.path === '/login') {
    if (from.path !== '/login') {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' }
      }).catch(() => {})
      clearAdminSession()
      localStorage.removeItem('admin_token')
    }
    return true
  }

  const authenticated = await checkAdminSession()
  if (!authenticated) return '/login'
  return true
})

export default router
