<template>
  <div class="desktop-learning">
    <section class="course-section">
      <div class="section-toolbar">
        <div class="section-heading">
          <strong>学习资源</strong>
          <span>共 {{ totalCount }} 项</span>
        </div>

        <div class="learning-summary" aria-label="学习进度概况">
          <div class="summary-item">
            <strong>{{ totalCount }}</strong>
            <span>全部</span>
          </div>
          <div class="summary-item completed">
            <strong>{{ completedCount }}</strong>
            <span>已完成</span>
          </div>
          <div class="summary-item learning">
            <strong>{{ inProgressCount }}</strong>
            <span>学习中</span>
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading-state">加载中...</div>

      <div v-else-if="!learningList.length" class="empty-state">
        <div class="empty-icon"><el-icon><Reading /></el-icon></div>
        <div class="empty-title">暂无学习资源</div>
        <div class="empty-desc">管理员发布学习资料后会显示在这里</div>
      </div>

      <template v-else>
        <div class="course-list">
          <article v-for="item in pagedLearningList" :key="item.id" class="course-card">
            <div class="course-header">
              <div class="course-title-wrap">
                <div class="resource-icon">
                  <el-icon><Document /></el-icon>
                </div>
                <div class="course-title">{{ item.title }}</div>
              </div>

              <el-tag :type="getStatusType(item.status)" effect="plain" size="small">
                {{ getStatusText(item.status) }}
              </el-tag>
            </div>

            <div v-if="item.description" class="course-desc">{{ item.description }}</div>

            <div class="course-meta">
              <span><el-icon><Clock /></el-icon>{{ item.duration || '未设置时长' }}</span>
              <span><el-icon><Document /></el-icon>PDF 文档</span>
            </div>

            <div class="progress-row">
              <span class="progress-label">学习进度</span>
              <div class="progress-main">
                <el-progress
                  :percentage="item.progress"
                  :color="getStatusColor(item.status)"
                  :stroke-width="6"
                  :show-text="false"
                />
              </div>
              <strong :class="['progress-value', item.status]">{{ item.progress }}%</strong>
            </div>

            <div class="course-footer">
              <span class="course-state-hint">{{ getStateHint(item.status) }}</span>
              <el-button
                :type="item.status === 'completed' ? 'default' : 'primary'"
                class="course-btn"
                @click="handleLearn(item)"
              >
                {{ item.status === 'completed' ? '复习课程' : item.status === 'in_progress' ? '继续学习' : '开始学习' }}
              </el-button>
            </div>
          </article>
        </div>

        <div v-if="learningList.length > pageSize" class="pagination-row">
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="learningList.length"
            layout="total, prev, pager, next, jumper"
            background
          />
        </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Clock, Document, Reading } from '@element-plus/icons-vue'
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
const currentPage = ref(1)
const pageSize = 9

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
  const map: Record<string, string> = { not_started: '#9aa5b4', in_progress: '#0475FA', completed: '#39ad59' }
  return map[status] || '#9aa5b4'
}

const getStateHint = (status: string) => {
  const map: Record<string, string> = {
    not_started: '尚未开始学习',
    in_progress: '继续完成当前资料',
    completed: '已完成，可再次查看'
  }
  return map[status] || ''
}

const totalCount = computed(() => learningList.value.length)
const completedCount = computed(() => learningList.value.filter(item => item.status === 'completed').length)
const inProgressCount = computed(() => learningList.value.filter(item => item.status === 'in_progress').length)
const pagedLearningList = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return learningList.value.slice(start, start + pageSize)
})

watch(learningList, () => {
  const maxPage = Math.max(1, Math.ceil(learningList.value.length / pageSize))
  if (currentPage.value > maxPage) currentPage.value = maxPage
})

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
      const progress = Math.max(0, Math.min(100, Number(item.progress ?? 0)))
      const status: LearningItem['status'] = progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'not_started'
      return {
        id: item.id,
        title: item.title,
        description: item.description || '',
        duration: item.duration || '',
        progress,
        status,
        type: 'pdf' as const,
        url: item.content || ''
      }
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

.course-section {
  background: #fff;
  border: 1px solid #e5eaf2;
}

.section-toolbar {
  min-height: 62px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid #e5eaf2;
}

.section-heading {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.section-heading strong {
  font-size: 18px;
  color: #1f2d3d;
}

.section-heading span {
  font-size: 13px;
  color: #8a97a8;
}

.learning-summary {
  display: flex;
  align-items: center;
  gap: 24px;
}

.summary-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
}

.summary-item strong {
  font-size: 18px;
  line-height: 1;
  color: #334155;
}

.summary-item span {
  font-size: 12px;
  color: #8a97a8;
}

.summary-item.completed strong {
  color: #2f9e4d;
}

.summary-item.learning strong {
  color: #0475fa;
}

.course-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  padding: 16px 20px 20px;
  align-items: start;
  background: #f4f6f9;
}

.course-card {
  min-width: 0;
  padding: 16px;
  background: #fff;
  border: 1px solid #dfe5ec;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.course-card:hover {
  border-color: #a9cfff;
  box-shadow: 0 3px 10px rgba(31, 45, 61, 0.06);
}

.course-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.course-title-wrap {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.resource-icon {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eef5ff;
  color: #0475fa;
}

.resource-icon .el-icon {
  font-size: 18px;
}

.course-title {
  min-width: 0;
  font-size: 15px;
  line-height: 1.45;
  font-weight: 600;
  color: #273444;
}

.course-header :deep(.el-tag) {
  flex: 0 0 auto;
  height: 24px;
  padding: 0 8px;
  border-radius: 0;
  font-size: 12px;
}

.course-desc {
  margin: 12px 0 0 44px;
  color: #7d8999;
  font-size: 12px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.course-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 15px;
  color: #8793a5;
  font-size: 12px;
}

.course-meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.course-meta .el-icon {
  font-size: 14px;
}

.progress-row {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-label {
  flex: 0 0 auto;
  font-size: 12px;
  color: #8793a5;
}

.progress-main {
  flex: 1;
  min-width: 80px;
}

.progress-main :deep(.el-progress-bar__outer),
.progress-main :deep(.el-progress-bar__inner) {
  border-radius: 0 !important;
}

.progress-value {
  flex: 0 0 38px;
  text-align: right;
  font-size: 12px;
  color: #6b7788;
}

.progress-value.completed {
  color: #2f9e4d;
}

.progress-value.in_progress {
  color: #0475fa;
}

.course-footer {
  min-height: 44px;
  margin-top: 14px;
  padding-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid #edf0f4;
}

.course-state-hint {
  min-width: 0;
  color: #98a3b3;
  font-size: 12px;
}

.course-btn {
  min-width: 88px;
  height: 32px;
  padding: 0 16px;
  border-radius: 0 !important;
}

.pagination-row {
  min-height: 58px;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  border-top: 1px solid #e5eaf2;
  background: #fff;
}

.pagination-row :deep(.el-pagination button),
.pagination-row :deep(.el-pager li),
.pagination-row :deep(.el-input__wrapper) {
  border-radius: 0 !important;
}

.loading-state {
  padding: 70px 0;
  text-align: center;
  color: #909399;
}

.empty-state {
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  width: 50px;
  height: 50px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eef5ff;
  color: #0475fa;
}

.empty-icon .el-icon {
  font-size: 25px;
}

.empty-title {
  margin-bottom: 5px;
  font-size: 16px;
  font-weight: 600;
  color: #425466;
}

.empty-desc {
  font-size: 13px;
  color: #98a3b3;
}

@media (max-width: 1250px) {
  .course-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 920px) {
  .section-toolbar {
    align-items: flex-start;
    flex-direction: column;
    padding: 14px 16px;
  }

  .course-list {
    grid-template-columns: 1fr;
  }
}
</style>
