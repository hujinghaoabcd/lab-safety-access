<template>
  <div class="desktop-dashboard">
    <div class="dashboard-main">
      <!-- 左侧主内容区 -->
      <div class="main-content">
        <!-- 欢迎区域 -->
        <div class="welcome-section">
          <div class="welcome-left">
            <span class="welcome-text">您好，{{ userInfo?.name || '用户' }}</span>
            <el-tag type="primary" effect="plain" class="role-tag">
              {{ userInfo?.department || '实验室安全教育考试系统' }}
            </el-tag>
          </div>
          <div class="welcome-right">
            <el-link type="primary" :underline="false">
              <el-icon><QuestionFilled /></el-icon>
              帮助文档
            </el-link>
          </div>
        </div>

        <!-- 功能卡片区域 -->
        <div class="function-cards">
          <div 
            v-for="item in functionCards" 
            :key="item.path"
            class="function-card"
            @click="navigateTo(item)"
          >
            <div class="card-icon" :style="{ background: item.iconBg }">
              <el-icon :style="{ color: item.iconColor }">
                <component :is="item.iconComponent" />
              </el-icon>
            </div>
            <div class="card-info">
              <h3>{{ item.title }}</h3>
              <p>{{ item.desc }}</p>
              <p class="sub-desc">{{ item.subDesc }}</p>
            </div>
          </div>
        </div>

        <!-- 统计数据区域 -->
        <div class="stats-section">
          <div class="stat-item">
            <div class="stat-value">
              <span class="number">{{ certCount }}</span>
              <span class="total">/{{ totalCerts }}</span>
            </div>
            <div class="stat-label">合格证书</div>
            <div class="stat-progress">
              <div class="progress-bar" :style="{ width: certProgress + '%' }"></div>
            </div>
          </div>

          <div class="stat-item">
            <div class="stat-value">
              <span class="number">{{ passedCount }}</span>
              <span class="total">/{{ totalExams }}</span>
            </div>
            <div class="stat-label">已通过考试</div>
            <div class="stat-progress">
              <div class="progress-bar success" :style="{ width: passProgress + '%' }"></div>
            </div>
          </div>

          <div class="stat-item">
            <div class="stat-value">
              <span class="number text-primary">{{ pendingExamCount }}</span>
              <span class="unit">项</span>
            </div>
            <div class="stat-label">待考试</div>
          </div>

          <div class="stat-item">
            <div class="stat-value">
              <span class="number">{{ wrongCount }}</span>
              <span class="unit">题</span>
            </div>
            <div class="stat-label">错题数量</div>
          </div>

          <div class="stat-item">
            <div class="stat-value">
              <span class="number">{{ studyHours }}</span>
              <span class="unit">小时</span>
            </div>
            <div class="stat-label">学习时长</div>
          </div>
        </div>
      </div>

      <!-- 右侧边栏 -->
      <div class="sidebar">
        <!-- 快捷入口卡片 -->
        <div class="sidebar-card quick-entry">
          <h3 class="card-title">快捷入口</h3>
          <div class="entry-buttons">
            <el-button type="primary" @click="router.push('/exam-center')">
              <el-icon><EditPen /></el-icon>
              开始考试
            </el-button>
            <el-button @click="router.push('/learning')">
              <el-icon><Reading /></el-icon>
              学习中心
            </el-button>
            <el-button @click="router.push('/certificate')">
              <el-icon><Medal /></el-icon>
              我的证书
            </el-button>
          </div>
        </div>

        <!-- 系统公告 -->
        <div class="sidebar-card">
          <div class="card-header">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="系统公告" name="notice"></el-tab-pane>
              <el-tab-pane label="快速入门" name="guide"></el-tab-pane>
            </el-tabs>
          </div>
          <div class="card-body">
            <template v-if="activeTab === 'notice'">
              <div class="notice-list">
                <div v-for="(notice, idx) in notices" :key="idx" class="notice-item">
                  <span class="notice-dot"></span>
                  <span class="notice-text">{{ notice.title }}</span>
                  <span class="notice-date">{{ notice.date }}</span>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="guide-list">
                <div v-for="(guide, idx) in guides" :key="idx" class="guide-item">
                  <span class="guide-step">{{ idx + 1 }}</span>
                  <span class="guide-text">{{ guide }}</span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { 
  QuestionFilled, EditPen, Reading, Medal,
  Document, Close, Trophy, User, Notebook, Clock
} from '@element-plus/icons-vue'
import { getExamList, getAnnouncement } from '@/api'
import { getUserProfileStats } from '@/api/auth'

const router = useRouter()
const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)

const activeTab = ref('notice')

const passedCount = ref(0)
const pendingExamCount = ref(0)
const certCount = ref(0)
const wrongCount = ref(0)
const studyHours = ref(0)
const totalExams = ref(10)
const totalCerts = ref(5)

const certProgress = computed(() => totalCerts.value > 0 ? (certCount.value / totalCerts.value) * 100 : 0)
const passProgress = computed(() => totalExams.value > 0 ? (passedCount.value / totalExams.value) * 100 : 0)

const functionCards = ref([
  { 
    iconComponent: Reading, 
    title: '学习中心', 
    desc: '在线学习安全知识课程',
    subDesc: '支持视频、文档、图文等',
    path: '/learning', 
    iconBg: '#e6f4ff', 
    iconColor: '#0475FA' 
  },
  { 
    iconComponent: EditPen, 
    title: '考试中心', 
    desc: '参加在线安全考核评测',
    subDesc: '支持多种题型在线答题',
    path: '/exam-center', 
    iconBg: '#f6ffed', 
    iconColor: '#52c41a' 
  },
  { 
    iconComponent: Medal, 
    title: '合格证书', 
    desc: '下载安全合格证书',
    subDesc: '考核通过后自动生成',
    path: '/certificate', 
    iconBg: '#fff7e6', 
    iconColor: '#fa8c16' 
  },
  { 
    iconComponent: Close, 
    title: '错题本', 
    desc: '复习巩固错题知识',
    subDesc: '智能归类历史错题',
    path: '/wrongbook', 
    iconBg: '#fff2f0', 
    iconColor: '#ff4d4f' 
  },
  { 
    iconComponent: Document, 
    title: '考试记录', 
    desc: '查看历史考试成绩',
    subDesc: '支持成绩查询与分析',
    path: '/records', 
    iconBg: '#f9f0ff', 
    iconColor: '#722ed1' 
  },
  { 
    iconComponent: Trophy, 
    title: '排行榜', 
    desc: '查看成绩排名情况',
    subDesc: '与其他学员对比成绩',
    path: '/ranking', 
    iconBg: '#e6fffb', 
    iconColor: '#13c2c2' 
  }
])

const notices = ref([
  { title: '实验室安全考核系统更新说明', date: '12-26' },
  { title: '2025年春季安全培训通知', date: '12-25' },
  { title: '系统维护公告', date: '12-20' },
  { title: '新增化学品安全课程', date: '12-15' },
  { title: '年度安全考核提醒', date: '12-10' }
])

const guides = ref([
  '登录系统后进入学习中心',
  '完成所有安全知识课程学习',
  '进入考试中心参加考核',
  '考核通过后下载合格证书',
  '定期复习错题巩固知识'
])

const navigateTo = (item: any) => {
  router.push(item.path)
}

onMounted(async () => {
  try {
    const examResp: any = await getExamList()
    const examData = examResp?.data ?? examResp
    const list: any[] = Array.isArray(examData?.list)
      ? examData.list
      : Array.isArray(examData)
        ? examData
        : []

    passedCount.value = list.filter(item => item.status === 'passed').length
    pendingExamCount.value = list.filter(item => item.status === 'available').length
    totalExams.value = list.length || 10

    const statsResp: any = await getUserProfileStats()
    const statsData = statsResp?.data ?? statsResp
    certCount.value = statsData?.certCount ?? 0
    wrongCount.value = statsData?.wrongCount ?? 12
    studyHours.value = statsData?.studyHours ?? 8
  } catch (err: any) {
    console.error('加载数据失败:', err)
  }
})
</script>

<style scoped>
.desktop-dashboard {
  padding: 0;
}

.dashboard-main {
  display: flex;
  gap: 20px;
}

.main-content {
  flex: 1;
  min-width: 0;
}

/* 欢迎区域 */
.welcome-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.welcome-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.welcome-text {
  font-size: 15px;
  color: #0475FA;
  font-weight: 500;
}

.role-tag {
  border-radius: 4px;
}

.welcome-right {
  display: flex;
  gap: 16px;
}

.welcome-right .el-link {
  font-size: 13px;
}

/* 功能卡片 */
.function-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.function-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  gap: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #f0f0f0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.function-card:hover {
  border-color: #0475FA;
  box-shadow: 0 4px 12px rgba(4, 117, 250, 0.12);
  transform: translateY(-2px);
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-icon .el-icon {
  font-size: 24px;
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-info h3 {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 6px 0;
}

.card-info p {
  font-size: 13px;
  color: #64748b;
  margin: 0;
  line-height: 1.4;
}

.card-info .sub-desc {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}

/* 统计数据区域 */
.stats-section {
  display: flex;
  background: #fff;
  border-radius: 8px;
  padding: 24px 0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.stat-item {
  flex: 1;
  text-align: center;
  padding: 0 20px;
  border-right: 1px solid #f0f0f0;
}

.stat-item:last-child {
  border-right: none;
}

.stat-value {
  margin-bottom: 8px;
}

.stat-value .number {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.stat-value .number.text-primary {
  color: #0475FA;
}

.stat-value .total {
  font-size: 14px;
  color: #94a3b8;
}

.stat-value .unit {
  font-size: 13px;
  color: #64748b;
  margin-left: 2px;
}

.stat-label {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 8px;
}

.stat-progress {
  width: 80%;
  height: 4px;
  background: #f0f0f0;
  border-radius: 2px;
  margin: 0 auto;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: #0475FA;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-bar.success {
  background: #52c41a;
}

/* 右侧边栏 */
.sidebar {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sidebar-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  margin: 0;
}

/* 快捷入口 */
.quick-entry .entry-buttons {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quick-entry .el-button {
  width: 100%;
  height: 40px;
  font-size: 14px;
}

/* 公告区域 */
.card-header {
  padding: 0 20px;
  border-bottom: 1px solid #f0f0f0;
}

.card-header :deep(.el-tabs__header) {
  margin: 0;
}

.card-header :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.card-header :deep(.el-tabs__item) {
  font-size: 14px;
  height: 48px;
  line-height: 48px;
}

.card-body {
  padding: 16px 20px;
}

.notice-list, .guide-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notice-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.notice-dot {
  width: 6px;
  height: 6px;
  background: #0475FA;
  border-radius: 50%;
  flex-shrink: 0;
}

.notice-text {
  flex: 1;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-date {
  color: #94a3b8;
  font-size: 12px;
  flex-shrink: 0;
}

.guide-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.guide-step {
  width: 20px;
  height: 20px;
  background: #0475FA;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.guide-text {
  color: #1e293b;
}
</style>
