import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { isDesktop } from '@/utils/device'
import { checkStudentSession } from '@/utils/session'

// 动态加载组件：桌面端优先，如果不存在则使用移动端
const loadComponent = (desktopComponent: () => Promise<any>, mobileComponent: () => Promise<any>) => {
  return () => {
    if (isDesktop()) {
      return desktopComponent().catch(() => mobileComponent())
    }
    return mobileComponent()
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: loadComponent(
      () => import('@/views/desktop/LoginPage.vue'),
      () => import('@/views/LoginPage.vue')
    ),
    meta: { title: '登录' }
  },
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: loadComponent(
      () => import('@/views/desktop/DashboardPage.vue'),
      () => import('@/views/DashboardPage.vue')
    ),
    meta: { title: '首页', requiresAuth: true }
  },
  {
    path: '/learning',
    name: 'Learning',
    component: loadComponent(
      () => import('@/views/desktop/LearningPage.vue'),
      () => import('@/views/LearningPage.vue')
    ),
    meta: { title: '学习中心', requiresAuth: true }
  },
  {
    path: '/exam-center',
    name: 'ExamCenter',
    component: loadComponent(
      () => import('@/views/desktop/ExamCenterPage.vue'),
      () => import('@/views/ExamCenterPage.vue')
    ),
    meta: { title: '考试中心', requiresAuth: true }
  },
  {
    path: '/exam-info',
    name: 'ExamInfo',
    component: loadComponent(
      () => import('@/views/desktop/ExamInfoPage.vue'),
      () => import('@/views/ExamInfoPage.vue')
    ),
    meta: { title: '考试说明', requiresAuth: true }
  },
  {
    path: '/exam',
    name: 'Exam',
    component: loadComponent(
      () => import('@/views/desktop/ExamPage.vue'),
      () => import('@/views/ExamPage.vue')
    ),
    meta: { title: '在线答题', requiresAuth: true }
  },
  {
    path: '/exam-result',
    name: 'ExamResult',
    component: loadComponent(
      () => import('@/views/desktop/ExamResultPage.vue'),
      () => import('@/views/ExamResultPage.vue')
    ),
    meta: { title: '答题汇总', requiresAuth: true }
  },
  {
    path: '/records',
    name: 'Records',
    component: loadComponent(
      () => import('@/views/desktop/RecordsPage.vue'),
      () => import('@/views/RecordsPage.vue')
    ),
    meta: { title: '考试记录', requiresAuth: true }
  },
  {
    path: '/record/:id',
    name: 'RecordDetail',
    component: loadComponent(
      () => import('@/views/desktop/RecordDetailPage.vue'),
      () => import('@/views/RecordDetailPage.vue')
    ),
    meta: { title: '考试详情', requiresAuth: true }
  },
  {
    path: '/wrongbook',
    name: 'WrongBook',
    component: loadComponent(
      () => import('@/views/desktop/WrongBookPage.vue'),
      () => import('@/views/WrongBookPage.vue')
    ),
    meta: { title: '错题本', requiresAuth: true }
  },
  {
    path: '/pdf-viewer',
    name: 'PdfViewer',
    component: loadComponent(
      () => import('@/views/desktop/PdfViewerPage.vue'),
      () => import('@/views/PdfViewerPage.vue')
    ),
    meta: { title: 'PDF 预览', requiresAuth: true }
  },
  {
    path: '/ranking',
    name: 'Ranking',
    component: loadComponent(
      () => import('@/views/desktop/RankingPage.vue'),
      () => import('@/views/RankingPage.vue')
    ),
    meta: { title: '排行榜', requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: loadComponent(
      () => import('@/views/desktop/ProfilePage.vue'),
      () => import('@/views/ProfilePage.vue')
    ),
    meta: { title: '个人中心', requiresAuth: true }
  },
  {
    path: '/certificate',
    name: 'Certificate',
    component: loadComponent(
      () => import('@/views/desktop/CertificatePage.vue'),
      () => import('@/views/CertificatePage.vue')
    ),
    meta: { title: '合格证书', requiresAuth: true }
  },
  ...(!isDesktop()
    ? [
        {
          path: '/about',
          name: 'About',
          component: () => import('@/views/AboutPage.vue'),
          meta: { title: '关于系统', requiresAuth: true }
        } as RouteRecordRaw
      ]
    : []),
  {
    path: '/help',
    name: 'Help',
    component: loadComponent(
      () => import('@/views/desktop/HelpPage.vue'),
      () => import('@/views/HelpPage.vue')
    ),
    meta: { title: '帮助说明', requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  document.title = `${to.meta.title || '实验室安全'} - 实验室安全教育考试系统`

  if (to.meta.requiresAuth) {
    const authenticated = await checkStudentSession()
    if (!authenticated) return '/login'
  }

  if (to.path === '/login' && await checkStudentSession()) {
    return '/dashboard'
  }

  return true
})

export default router
