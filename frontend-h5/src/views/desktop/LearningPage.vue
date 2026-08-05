<template>
  <div class="desktop-learning">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <div class="header-icon">
          <el-icon><Reading /></el-icon>
        </div>
        <div class="header-info">
          <h1>学习中心</h1>
          <p>在线学习实验室安全知识</p>
        </div>
      </div>
      <div class="header-stats">
        <div class="stat-item">
          <span class="stat-num">{{ totalCount }}</span>
          <span class="stat-text">全部</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-num success">{{ completedCount }}</span>
          <span class="stat-text">已完成</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-num primary">{{ inProgressCount }}</span>
          <span class="stat-text">学习中</span>
        </div>
      </div>
    </div>

    <!-- 课程列表 -->
    <div class="course-section">
      <div class="section-title">学习资源</div>

      <el-empty v-if="!loading && !learningList.length" description="暂无学习资源" />

      <div v-else class="course-list">
        <div v-for="item in learningList" :key="item.id" class="course-card">
          <div class="course-header">
            <div class="course-title">{{ item.title }}</div>
            <el-tag :type="getStatusType(item.status)" size="small">
              {{ getStatusText(item.status) }}
            </el-tag>
          </div>
          
          <div class="course-desc">{{ item.description }}</div>
          
          <div class="course-meta">
            <span><el-icon><Clock /></el-icon> {{ item.duration }}</span>
            <span><el-icon><Document /></el-icon> PDF 文档</span>
          </div>

          <el-progress :percentage="item.progress" :color="getStatusColor(item.status)" :stroke-width="8" />

          <el-button
            :type="item.status === 'completed' ? 'default' : 'primary'"
            class="course-btn"
            @click="handleLearn(item)"
          >
            {{ item.status === 'completed' ? '复习课程' : item.status === 'in_progress' ? '继续学习' : '开始学习' }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Reading, Document, Clock } from '@element-plus/icons-vue'
import { getLearningList } from '@/api/learning'

const router = useRouter()

interface LearningItem {
  id: string | number
  title: string
  description: string
  duration: string
  progress: number
  status: 'not_started' | 'in_progress' | 'completed'
  type: 'pdf'
  url: string
}

const loading = ref(false)
const learningList = ref<LearningItem[]>([])

const fallbackItems: LearningItem[] = [
  {
    id: 'demo-pdf',
    title: '实验室安全手册（PDF 示例）',
    description: '示例：点击后打开一份复杂的多页 PDF 手册',
    duration: '约 30 分钟',
    progress: 0,
    status: 'not_started',
    type: 'pdf',
    url: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf'
  }
]

const getStatusText = (status: string) => {
  const map: Record<string, string> = { not_started: '未开始', in_progress: '学习中', completed: '已完成' }
  return map[status] || status
}

const getStatusType = (status: string) => {
  const map: Record<string, string> = { not_started: 'info', in_progress: 'primary', completed: 'success' }
  return map[status] || 'info'
}

const getStatusColor = (status: string) => {
  const map: Record<string, string> = { not_started: '#909399', in_progress: '#0475FA', completed: '#67c23a' }
  return map[status] || '#909399'
}

const totalCount = computed(() => learningList.value.length)
const completedCount = computed(() => learningList.value.filter(item => item.status === 'completed').length)
const inProgressCount = computed(() => learningList.value.filter(item => item.status === 'in_progress').length)

const handleLearn = async (item: LearningItem) => {
  if (!item.url) {
    ElMessage.warning('该学习资源暂未配置链接')
    return
  }
  router.push({ path: '/pdf-viewer', query: { url: encodeURIComponent(item.url), id: item.id } })
}

onMounted(async () => {
  loading.value = true
  try {
    const resp: any = await getLearningList()
    const data = resp?.data ?? resp
    const rawList: any[] = Array.isArray(data?.list) ? data.list : Array.isArray(data) ? data : []

    if (!rawList.length) {
      learningList.value = fallbackItems
      return
    }

    learningList.value = rawList.map((item: any) => {
      const progress = item.progress ?? 0
      const status: LearningItem['status'] = progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'not_started'
      return { id: item.id, title: item.title, description: item.description || '', duration: item.duration || '', progress, status, type: 'pdf' as const, url: item.content || '' }
    })
  } catch (err: any) {
    ElMessage.error(err?.message || '获取学习列表失败')
    learningList.value = fallbackItems
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.desktop-learning {
  padding: 0;
}

/* 页面头部 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  width: 48px;
  height: 48px;
  background: #0475FA;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-icon .el-icon {
  font-size: 24px;
  color: #fff;
}

.header-info h1 {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 4px 0;
}

.header-info p {
  font-size: 13px;
  color: #909399;
  margin: 0;
}

.header-stats {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px 20px;
  background: #f5f7fa;
  border-radius: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-num {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}

.stat-num.success { color: #67c23a; }
.stat-num.primary { color: #0475FA; }

.stat-text {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.stat-divider {
  width: 1px;
  height: 32px;
  background: #dcdfe6;
}

/* 课程列表 */
.course-section {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
}

.course-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.course-card {
  padding: 20px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.course-card:hover {
  border-color: #0475FA;
  box-shadow: 0 4px 12px rgba(4, 117, 250, 0.1);
}

.course-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.course-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  flex: 1;
  margin-right: 12px;
}

.course-desc {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  margin-bottom: 16px;
  min-height: 40px;
}

.course-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #909399;
}

.course-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.course-meta .el-icon {
  font-size: 14px;
}

.course-btn {
  width: 100%;
  margin-top: 16px;
}
</style>
