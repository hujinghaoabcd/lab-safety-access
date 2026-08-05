<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { getExamDetail } from '../api'

const router = useRouter()
const route = useRoute()

const examId = (route.query.examId as string) || ''

const examInfo = ref<{
  id: string
  name: string
  description: string
  duration: number
  questionCount: number
  passScore: number
  totalScore: number
  rules: string[]
}>({
  id: examId || '',
  name: '',
  description: '',
  duration: 0,
  questionCount: 0,
  passScore: 0,
  totalScore: 0,
  rules: []
})

const loading = ref(false)
const agreed = ref(false)

const handleStartExam = async () => {
  if (!agreed.value) return

  await showConfirmDialog({
    title: '开始考试',
    message: '确定要开始考试吗？考试开始后计时器将启动。'
  })
  
  router.push({
    path: '/exam',
    query: { examId: examInfo.value.id }
  })
}

onMounted(async () => {
  if (!examId) {
    showToast('缺少考试ID')
    router.back()
    return
  }
  try {
    loading.value = true
    const resp: any = await getExamDetail(examId)
    const data = resp?.data ?? resp
    console.log('[ExamInfo] getExamDetail response:', data)

    examInfo.value.id = String(data.id)
    examInfo.value.name = data.name || '实验室安全考试'
    examInfo.value.description = data.description || ''
    examInfo.value.duration = data.duration || 0
    examInfo.value.questionCount = data.questionCount || 0
    examInfo.value.passScore = data.passScore || 0
    examInfo.value.totalScore = data.totalScore || 100

    // 考试须知完全使用数据库中的 description 文本：一行对应一条规则
    examInfo.value.rules = (examInfo.value.description || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0)
  } catch (err: any) {
    console.error('[ExamInfo] getExamDetail error:', err)
    showToast(err?.message || '加载考试信息失败')
    router.back()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="exam-info-page">
    <van-nav-bar class="blue-nav" title="考试说明" left-arrow @click-left="router.back()" />

    <div class="content">
      <div class="info-card">
        <h2 class="exam-title">{{ examInfo.name || '实验室安全考试' }}</h2>
        <!-- <p class="exam-subtitle">
          {{ examInfo.description || '请仔细阅读考试说明后开始答题。' }}
        </p> -->
        
        <div class="exam-meta">
          <div class="meta-item">
            <span class="meta-icon">⏱️</span>
            <span class="label">考试时长</span>
            <span class="value">{{ examInfo.duration }}分钟</span>
          </div>
          <div class="meta-divider"></div>
          <div class="meta-item">
            <span class="meta-icon">📋</span>
            <span class="label">题目数量</span>
            <span class="value">{{ examInfo.questionCount }}题</span>
          </div>
          <div class="meta-divider"></div>
          <div class="meta-item">
            <span class="meta-icon">🎯</span>
            <span class="label">及格分数</span>
            <span class="value">{{ examInfo.passScore }}分</span>
          </div>
          <div class="meta-divider"></div>
          <div class="meta-item">
            <span class="meta-icon">🏆</span>
            <span class="label">满分</span>
            <span class="value">{{ examInfo.totalScore }}分</span>
          </div>
        </div>
      </div>

      <div class="rules-card">
        <h3 class="section-title">📌 考试须知</h3>
        <ul class="rules-list">
          <li v-for="(rule, index) in examInfo.rules" :key="index">
            <span class="rule-number">{{ index + 1 }}</span>
            <span class="rule-text">{{ rule }}</span>
          </li>
        </ul>
      </div>

      <div class="agreement">
        <van-checkbox v-model="agreed" shape="square" icon-size="4vw">
          我已阅读并理解以上考试须知
        </van-checkbox>
      </div>

      <div class="btn-wrapper">
        <van-button
          type="primary"
          block
          size="large"
          :disabled="!agreed"
          @click="handleStartExam"
        >
          开始考试
        </van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exam-info-page {
  min-height: 100vh;
  background: #f7f8fa;
}

.content {
  padding: 4vw;
}

.info-card {
  background: #fff;
  padding: 5.333vw;
  margin-bottom: 4vw;
}

.exam-title {
  font-size: 5.333vw;
  font-weight: 600;
  color: #323233;
  text-align: center;
  margin-bottom: 2vw;
}

.exam-subtitle {
  font-size: 3.2vw;
  color: #969799;
  text-align: center;
  margin-bottom: 5.333vw;
}

.exam-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.meta-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2vw;
  flex: 1;
}

.meta-divider {
  width: 1px;
  height: 10vw;
  background: #ebedf0;
}

.meta-icon {
  font-size: 5vw;
  margin-bottom: 1.5vw;
}

.meta-item .label {
  font-size: 3.2vw;
  color: #969799;
  margin-bottom: 1.6vw;
}

.meta-item .value {
  font-size: 4.8vw;
  font-weight: 600;
  color: #0475FA;
}

.rules-card {
  background: #fff;
  padding: 5.333vw;
  margin-bottom: 4vw;
}

.section-title {
  font-size: 4vw;
  font-weight: 600;
  color: #323233;
  margin-bottom: 4vw;
}

.rules-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.rules-list li {
  display: flex;
  align-items: flex-start;
  gap: 3vw;
  margin-bottom: 3vw;
}

.rules-list li:last-child {
  margin-bottom: 0;
}

.rule-number {
  width: 5vw;
  height: 5vw;
  background: #0475FA;
  color: #fff;
  font-size: 3vw;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.rule-text {
  font-size: 3.733vw;
  color: #646566;
  line-height: 1.6;
  padding-top: 0.5vw;
}

.agreement {
  margin: 5.333vw 0;
}

.btn-wrapper {
  padding: 0 4vw;
}
</style>
