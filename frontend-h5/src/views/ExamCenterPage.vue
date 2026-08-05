<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { getExamList } from '../api'

const router = useRouter()

interface ExamItem {
  id: number | string
  name: string
  description: string
  duration: number
  questionCount: number
  passScore: number
  totalScore: number
  status: 'available' | 'not_available' | 'passed'
}

const examList = ref<ExamItem[]>([])
const loading = ref(false)

const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    available: '可参加',
    not_available: '暂不可考',
    passed: '已通过'
  }
  return map[status] || status
}

const getStatusColor = (status: string) => {
  const map: Record<string, string> = {
    available: '#0475FA',
    not_available: '#969799',
    passed: '#07c160'
  }
  return map[status] || '#969799'
}

const startExam = (exam: ExamItem) => {
  if (exam.status !== 'available') return
  router.push({
    path: '/exam-info',
    query: { examId: String(exam.id) }
  })
}

onMounted(async () => {
  try {
    loading.value = true
    const resp: any = await getExamList()
    const data = resp?.data ?? resp
    console.log('[ExamCenter] getExamList response:', data)
    examList.value = (data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description || '实验室安全考试',
      duration: item.duration,
      questionCount: item.questionCount,
      passScore: item.passScore,
      totalScore: item.totalScore,
      status: item.status
    }))
  } catch (err: any) {
    console.error('[ExamCenter] getExamList error:', err)
    showToast(err?.message || '加载考试列表失败')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="exam-center-page">
    <van-nav-bar class="blue-nav" title="考试中心" left-arrow @click-left="router.back()" />

    <div class="content">
      <div v-if="loading" class="loading-text">正在加载考试列表...</div>

      <div v-else-if="!examList.length" class="empty-text">暂无可参加的考试</div>

      <div v-else class="exam-list">
        <div
          v-for="item in examList"
          :key="item.id"
          class="exam-item"
        >
          <div class="exam-header">
            <h3 class="exam-title">{{ item.name }}</h3>
            <van-tag :color="getStatusColor(item.status)" plain>
              {{ getStatusText(item.status) }}
            </van-tag>
          </div>
          
          <p class="exam-desc">{{ item.name }}</p>
          
          <div class="exam-meta">
            <span class="meta-item">⏱️ {{ item.duration }}分钟</span>
            <span class="meta-item">📝 {{ item.questionCount }}题</span>
            <span class="meta-item">✅ {{ item.passScore }}分及格</span>
          </div>

          <div class="exam-footer">
            <button
              v-if="item.status === 'available'"
              class="exam-btn primary"
              @click="startExam(item)"
            >
              进入考试
            </button>
            <button
              v-else-if="item.status === 'passed'"
              class="exam-btn success"
              disabled
            >
              已通过
            </button>
            <button
              v-else
              class="exam-btn disabled"
              disabled
            >
              暂不可考
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exam-center-page {
  min-height: 100vh;
  background: #f7f8fa;
}

.content {
  padding: 4vw;
}

.exam-list {
  display: flex;
  flex-direction: column;
  gap: 3vw;
}

.exam-item {
  background: #fff;
  padding: 4vw;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.exam-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2vw;
}

.exam-title {
  font-size: 4vw;
  font-weight: 600;
  color: #323233;
}

.exam-desc {
  font-size: 3.2vw;
  color: #969799;
  margin-bottom: 3vw;
  line-height: 1.4;
}

.exam-meta {
  display: flex;
  gap: 4vw;
  margin-bottom: 3vw;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 1vw;
  font-size: 3vw;
  color: #646566;
}

.exam-footer {
  display: flex;
  justify-content: flex-end;
}

.exam-btn {
  padding: 2vw 5vw;
  font-size: 3.2vw;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}

.exam-btn.primary {
  background: #0475FA;
  color: #fff;
}

.exam-btn.success {
  background: #e8f8f0;
  color: #07c160;
}

.exam-btn.disabled {
  background: #f5f5f5;
  color: #c8c9cc;
  cursor: not-allowed;
}

.exam-btn:active:not(:disabled) {
  opacity: 0.8;
}
</style>
