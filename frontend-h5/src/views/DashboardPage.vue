<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { showToast } from 'vant'
import { getExamList, getBanners, getAnnouncement } from '@/api'
import { getUserProfileStats } from '@/api/auth'

const router = useRouter()
const userStore = useUserStore()

const passedCount = ref(0)
const pendingExamCount = ref(0)
const certCount = ref(0)

const menuItems = ref([
  { icon: '📚', title: '学习中心', desc: '查看学习资料', path: '/learning', color: '#0475FA', disabled: false },
  { icon: '📝', title: '考试中心', desc: '在线考试与测评', path: '/exam-center', color: '#07c160' },
  { icon: '📋', title: '考试记录', desc: '查看历史记录', path: '/records', color: '#ff976a' },
  { icon: '❌', title: '错题本', desc: '复习巩固知识', path: '/wrongbook', color: '#ee0a24' },
  { icon: '🏆', title: '排行榜', desc: '查看成绩排名', path: '/ranking', color: '#FFB800' },
  { icon: '📜', title: '合格证书', desc: '下载合格证书', path: '/certificate', color: '#0475FA' },
  { icon: '👤', title: '个人中心', desc: '查看个人信息', path: '/profile', color: '#969799' },
  { icon: '❓', title: '帮助说明', desc: '使用指南', path: '/help', color: '#8E8E93' }
])

const bannerList = ref([
  { id: 1, image: '', title: '实验室安全教育', subtitle: '安全第一，预防为主', color: '#0475FA' },
  { id: 2, image: '', title: '考试通知', subtitle: '本学期安全考核已开放', color: '#07c160' },
  { id: 3, image: '', title: '课程上线', subtitle: '课程等待上线中...', color: '#ff976a' }
])

const announcementText = ref('请各位同学完成实验室安全教育考核, 尽快提交成绩！')

const navigateTo = (item: any) => {
  if (item.disabled) {
    showToast('功能暂未开放');
    return;
  }
  router.push(item.path);
};

onMounted(async () => {
  try {
    // 加载跑马灯数据
    try {
      const bannerResp: any = await getBanners()
      const bannerData = bannerResp?.data ?? bannerResp
      if (Array.isArray(bannerData) && bannerData.length > 0) {
        bannerList.value = bannerData.map((b: any) => ({
          id: b.id,
          image: '',
          title: b.title,
          subtitle: b.subtitle || '',
          color: b.color || '#0475FA'
        }))
      }
    } catch (err) {
      console.warn('加载跑马灯失败，使用默认数据:', err)
    }

    // 加载公告数据
    try {
      const annResp: any = await getAnnouncement()
      const annData = annResp?.data ?? annResp
      if (annData && typeof annData === 'string' && annData.trim()) {
        announcementText.value = annData
      }
    } catch (err) {
      console.warn('加载公告失败，使用默认数据:', err)
    }

    // 考试列表：用于统计"已通过 / 待考试"
    const examResp: any = await getExamList()
    const examData = examResp?.data ?? examResp
    // 后端 /exam/list 直接返回数组 list，或者被封装在 data.list 中
    const list: any[] = Array.isArray(examData?.list)
      ? examData.list
      : Array.isArray(examData)
        ? examData
        : []

    passedCount.value = list.filter(item => item.status === 'passed').length
    pendingExamCount.value = list.filter(item => item.status === 'available').length

    // 用户统计数据：用于统计"合格证书"数量
    const statsResp: any = await getUserProfileStats()
    const statsData = statsResp?.data ?? statsResp
    certCount.value = statsData?.certCount ?? 0
  } catch (err: any) {
    console.error('加载数据失败:', err)
    showToast(err?.message || '加载数据失败')
  }
})
</script>

<template>
  <div class="dashboard-page">
    <!-- 轮播图走马灯 -->
    <div class="banner-swipe">
      <van-swipe :autoplay="3000" indicator-color="#0475FA">
        <van-swipe-item v-for="banner in bannerList" :key="banner.id">
          <div class="banner-item" :style="{ background: `linear-gradient(135deg, ${banner.color} 0%, ${banner.color}99 100%)` }">
            <div class="banner-content">
              <h3>{{ banner.title }}</h3>
              <p>{{ banner.subtitle }}</p>
            </div>
            <div class="banner-icon">🔬</div>
          </div>
        </van-swipe-item>
      </van-swipe>
    </div>

    <!-- 公告通知 -->
    <div class="notice-bar">
      <div class="notice-icon">
        <van-icon name="volume-o" color="#0475FA" size="4.5vw" />
      </div>
      <van-notice-bar
        class="notice-content"
        left-icon=""
        :text="announcementText"
        background="transparent"
        color="#999"
      />
    </div>

    <!-- 状态统计卡片 -->
    <div class="status-card">
      <div class="status-item">
        <span class="value text-primary">{{ certCount }}</span>
        <span class="label">合格证书</span>
      </div>
      <div class="status-item">
        <span class="value text-success">{{ passedCount }}</span>
        <span class="label">已通过</span>
      </div>
      <div class="status-item">
        <span class="value text-warning">{{ pendingExamCount }}</span>
        <span class="label">待考试</span>
      </div>
    </div>

    <!-- 功能菜单 -->
    <div class="menu-grid">
      <div
        v-for="item in menuItems"
        :key="item.path"
        class="menu-item"
        @click="navigateTo(item)"
      >
        <div class="icon" :style="{ backgroundColor: item.color + '20' }">
          {{ item.icon }}
        </div>
        <div class="menu-text">
          <p class="menu-title">{{ item.title }}</p>
          <p class="menu-desc">{{ item.desc }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  background: #f7f8fa;
  padding: 4vw;
  padding-bottom: 20vw;
}

/* 轮播图 */
.banner-swipe {
  margin-bottom: 4vw;
}

.banner-item {
  height: 37vw;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5.333vw;
  color: #fff;
}

.banner-content h3 {
  font-size: 5.333vw;
  font-weight: 600;
  margin-bottom: 2.133vw;
}

.banner-content p {
  font-size: 3.733vw;
  opacity: 0.9;
}

.banner-icon {
  font-size: 16vw;
  opacity: 0.3;
}

/* 公告通知 */
.notice-bar {
  display: flex;
  align-items: center;
  background: #fff;
  margin-bottom: 4vw;
  box-shadow: 0 0.533vw 2.667vw rgba(0, 0, 0, 0.05);
  padding-left: 4vw;
}

.notice-icon {
  display: flex;
  align-items: center;
}

.notice-content {
  flex: 1;
}

.notice-content :deep(.van-notice-bar__content) {
  font-weight: 500;
}

/* 状态卡片 */
.status-card {
  display: flex;
  background: #fff;
  padding: 5.333vw 0;
  margin-bottom: 4vw;
  box-shadow: 0 0.533vw 2.667vw rgba(0, 0, 0, 0.05);
}

.status-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-right: 1px solid #ebedf0;
}

.status-item:last-child {
  border-right: none;
}

.status-item .value {
  font-size: 6.4vw;
  font-weight: 600;
}

.status-item .label {
  font-size: 3.2vw;
  color: #969799;
  margin-top: 1.6vw;
}

/* 菜单网格 */
.menu-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 3.2vw;
}

.menu-item {
  background: #fff;
  padding: 4vw;
  display: flex;
  align-items: center;
  gap: 3.2vw;
  box-shadow: 0 0.533vw 2.667vw rgba(0, 0, 0, 0.05);
}

.menu-item .icon {
  width: 12vw;
  height: 12vw;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 6.4vw;
}

.menu-text .menu-title {
  font-size: 3.733vw;
  font-weight: 500;
  color: #323233;
}

.menu-text .menu-desc {
  font-size: 2.933vw;
  color: #969799;
  margin-top: 0.8vw;
}
</style>
