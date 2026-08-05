<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { getLearningList } from '@/api/learning'

const router = useRouter()

interface LearningItem {
  id: string | number
  title: string
  description: string
  duration: string
  progress: number
  status: 'not_started' | 'in_progress' | 'completed'
  // 资源类型：只支持 PDF
  type: 'pdf'
  // PDF 链接
  url: string
}

const loading = ref(false)
const learningList = ref<LearningItem[]>([])

// 本地示例 PDF（当后台暂无数据时的占位）
const fallbackItems: LearningItem[] = [
  {
    id: 'demo-pdf',
    title: '实验室安全手册（PDF 示例）',
    description: '示例：点击后打开一份复杂的多页 PDF 手册（包含图表、表格等复杂元素）',
    duration: '约 30 分钟',
    progress: 0,
    status: 'not_started',
    type: 'pdf',
    url: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf'
  }
]

const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    not_started: '未开始',
    in_progress: '学习中',
    completed: '已完成'
  }
  return map[status] || status
}

const getStatusColor = (status: string) => {
  const map: Record<string, string> = {
    not_started: '#969799',
    in_progress: '#0475FA',
    completed: '#07c160'
  }
  return map[status] || '#969799'
}

const totalCount = computed(() => learningList.value.length)
const completedCount = computed(
  () => learningList.value.filter(item => item.status === 'completed').length
)
const inProgressCount = computed(
  () => learningList.value.filter(item => item.status === 'in_progress').length
)

const handleLearn = async (item: LearningItem) => {
  if (!item.url) {
    showToast('该学习资源暂未配置 PDF 链接')
    return
  }

  // PDF 使用内置预览页面渲染
  const encoded = encodeURIComponent(item.url)
  router.push({ 
    path: '/pdf-viewer', 
    query: { 
      url: encoded,
      id: item.id 
    } 
  })
}

// 加载学习列表（提取为独立函数以便复用）
const loadLearningList = async () => {
  loading.value = true
  try {
    const resp: any = await getLearningList()
    const data = resp?.data ?? resp
    const rawList: any[] = Array.isArray(data?.list)
      ? data.list
      : Array.isArray(data)
        ? data
        : []

    if (!rawList.length) {
      // 后台暂无数据时，先用两个示例占位
      learningList.value = fallbackItems
      return
    }

    learningList.value = rawList.map((item: any) => {
      const progress = item.progress ?? 0
      const status: LearningItem['status'] =
        progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'not_started'

      // 只支持 PDF，content 字段存储 PDF 访问路径或完整 URL
      const content: string = item.content || ''
      const url: string = content

      return {
        id: item.id,
        title: item.title,
        description: item.description || '',
        duration: item.duration || '',
        progress,
        status,
        type: 'pdf' as const,
        url
      } as LearningItem
    })
  } catch (err: any) {
    console.error('获取学习列表失败:', err)
    showToast(err?.message || '获取学习列表失败')
    // 出错时也用本地示例兜底
    learningList.value = fallbackItems
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadLearningList()
})
</script>

<template>
  <div class="learning-page">
    <van-nav-bar class="blue-nav" title="学习中心" left-arrow @click-left="router.back()" />

    <div class="content">
      <div class="summary-card">
        <div class="summary-item">
          <span class="value">{{ totalCount }}</span>
          <span class="label">全部资源</span>
        </div>
        <div class="summary-item">
          <span class="value text-success">{{ completedCount }}</span>
          <span class="label">已完成</span>
        </div>
        <div class="summary-item">
          <span class="value text-primary">{{ inProgressCount }}</span>
          <span class="label">学习中</span>
        </div>
      </div>

      <div class="course-list">
        <div
          v-for="item in learningList"
          :key="item.id"
          class="course-item"
        >
          <div class="course-header">
            <h3 class="course-title">{{ item.title }}</h3>
            <van-tag :color="getStatusColor(item.status)" plain>
              {{ getStatusText(item.status) }}
            </van-tag>
          </div>
          <p class="course-desc">{{ item.description }}</p>
          <div class="course-meta">
            <span>⏱️ {{ item.duration }}</span>
            <span class="course-type">PDF 文档</span>
          </div>
          <van-progress
            :percentage="item.progress"
            :stroke-width="8"
            :color="getStatusColor(item.status)"
          />
          <van-button
            :type="item.status === 'completed' ? 'default' : 'primary'"
            size="small"
            round
            class="course-btn"
            @click="handleLearn(item)"
          >
            {{ item.status === 'completed' ? '复习课程' : item.status === 'in_progress' ? '继续学习' : '开始学习' }}
          </van-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.learning-page {
  min-height: 100vh;
  background: #f7f8fa;
}

.content {
  padding: 4vw;
}

.summary-card {
  display: flex;
  background: #fff;
  border-radius: 0;
  padding: 5.333vw 0;
  margin-bottom: 4vw;
}

.summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.summary-item .value {
  font-size: 6.4vw;
  font-weight: 600;
  color: #323233;
}

.summary-item .label {
  font-size: 3.2vw;
  color: #969799;
  margin-top: 1.6vw;
}

.course-list {
  display: flex;
  flex-direction: column;
  gap: 3.2vw;
}

.course-item {
  background: #fff;
  border-radius: 0;
  padding: 4vw;
}

.course-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2.667vw;
}

.course-title {
  font-size: 4vw;
  font-weight: 600;
  color: #323233;
}

.course-desc {
  font-size: 3.467vw;
  color: #646566;
  margin-bottom: 2.667vw;
  line-height: 1.5;
}

.course-meta {
  font-size: 3.2vw;
  color: #969799;
  margin-bottom: 2.667vw;
}

.course-type {
  margin-left: 3.2vw;
}

.course-btn {
  margin-top: 3.2vw;
  width: 100%;
}
</style>

