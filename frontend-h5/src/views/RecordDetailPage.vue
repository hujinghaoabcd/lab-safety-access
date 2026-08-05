<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast } from 'vant'
import { getRecordDetail } from '../api'

const router = useRouter()
const route = useRoute()

const recordId = route.params.id as string

interface QuestionResult {
  id: number | string
  type: string
  content: string
  options: string[]
  userAnswer: string | string[]
  correctAnswer: string
  isCorrect: boolean
}

const recordInfo = ref({
  id: recordId,
  examTitle: '',
  score: 0,
  totalScore: 0,
  passed: false,
  correctCount: 0,
  wrongCount: 0,
  duration: '',
  submitTime: ''
})

const questions = ref<QuestionResult[]>([])

const showOnlyWrong = ref(false)

const filteredQuestions = computed(() => {
  if (showOnlyWrong.value) {
    return questions.value.filter(q => !q.isCorrect)
  }
  return questions.value
})

// 获取选项状态
const getOptionStatus = (q: QuestionResult, opt: string) => {
  const optLetter = opt.charAt(0)

  // 多选题：userAnswer 可能是数组，correctAnswer 也可能是 "ACD"
  const userAns = q.userAnswer
  const correctAns = q.correctAnswer

  const isUserAnswer = Array.isArray(userAns)
    ? userAns.includes(optLetter)
    : userAns === optLetter || userAns === opt.substring(3)

  const isCorrectAnswer = correctAns.includes(optLetter) || correctAns === opt.substring(3)
  
  if (isCorrectAnswer) {
    return 'correct' // 正确答案 - 蓝色勾
  } else if (isUserAnswer && !q.isCorrect) {
    return 'wrong' // 用户选错 - 红色叉
  }
  return 'default' // 默认 - 灰色圈
}

onMounted(async () => {
  if (!recordId) {
    showToast('缺少记录ID')
    router.back()
    return
  }

  try {
    const resp: any = await getRecordDetail(recordId)
    const data = resp?.data ?? resp
    console.log('[RecordDetail] getRecordDetail response:', data)

    recordInfo.value.id = data.id
    recordInfo.value.examTitle = data.examTitle
    recordInfo.value.score = data.score
    recordInfo.value.totalScore = data.totalScore
    recordInfo.value.passed = data.passed
    recordInfo.value.duration = data.duration
    recordInfo.value.submitTime = data.submitTime

    const qs: QuestionResult[] = (data.questions || []).map((q: any) => ({
      id: q.id,
      type: q.type,
      content: q.content,
      options: (q.options || []).map((text: string, idx: number) => {
        const letter = String.fromCharCode(65 + idx)
        return `${letter}. ${text}`
      }),
      userAnswer: q.userAnswer ?? '',
      correctAnswer: q.correctAnswer ?? '',
      isCorrect: q.isCorrect
    }))

    questions.value = qs
    recordInfo.value.correctCount = qs.filter(q => q.isCorrect).length
    recordInfo.value.wrongCount = qs.length - recordInfo.value.correctCount
  } catch (err: any) {
    console.error('[RecordDetail] getRecordDetail error:', err)
    showToast(err?.message || '加载考试详情失败')
    router.back()
  }
})
</script>

<template>
  <div class="record-detail-page">
    <van-nav-bar class="blue-nav" title="考试详情" left-arrow @click-left="router.back()" />

    <div class="content">
      <!-- 顶部统计栏 -->
      <div class="top-stats">
        <div class="stat-item">
          <van-icon name="edit" color="#0475FA" size="4vw" />
          <span>答对题目：<strong>{{ recordInfo.correctCount }}题</strong></span>
        </div>
        <div class="stat-item">
          <van-icon name="underway-o" color="#0475FA" size="4vw" />
          <span>用时：<strong>{{ recordInfo.duration }}</strong></span>
        </div>
      </div>

      <!-- 题目列表 -->
      <div class="question-list">
        <div
          v-for="(q, index) in filteredQuestions"
          :key="q.id"
          class="question-card"
        >
          <!-- 卡片头部 -->
          <div class="card-header">
            <span class="q-index">{{ index + 1 }}/{{ questions.length }}</span>
            <span class="q-type">{{ q.type === 'single' ? '单选题' : q.type === 'multiple' ? '多选题' : '判断题' }}</span>
          </div>
          
          <!-- 卡片内容 -->
          <div class="card-body">
            <p class="question-text">{{ q.content }}</p>
            
            <div class="options-list">
              <div
                v-for="opt in q.options"
                :key="opt"
                class="option-row"
                :class="getOptionStatus(q, opt)"
              >
                <span class="option-letter">{{ opt.charAt(0) }}</span>
                <span class="option-text">{{ opt.substring(3) }}</span>
                <div class="option-icon">
                  <van-icon 
                    v-if="getOptionStatus(q, opt) === 'wrong'" 
                    name="cross" 
                    color="#fff"
                    size="4vw"
                  />
                  <van-icon 
                    v-else-if="getOptionStatus(q, opt) === 'correct'" 
                    name="success" 
                    color="#fff"
                    size="4vw"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.record-detail-page {
  min-height: 100vh;
  background: #f5f6fa;
}

.content {
  padding: 4vw;
}

/* 顶部统计栏 */
.top-stats {
  display: flex;
  justify-content: space-between;
  padding: 4vw 5vw;
  background: #fff;
  margin-bottom: 4vw;
}

.top-stats .stat-item {
  display: flex;
  align-items: center;
  gap: 2vw;
  font-size: 3.5vw;
  color: #666;
}

.top-stats .stat-item strong {
  color: #323233;
}

/* 题目列表 */
.question-list {
  display: flex;
  flex-direction: column;
  gap: 4vw;
}

.question-card {
  background: #fff;
  overflow: hidden;
}

/* 卡片头部 */
.card-header {
  display: flex;
  align-items: center;
  gap: 4vw;
  padding: 4vw 5vw;
  border-bottom: 1px solid #f0f0f0;
}

.q-index {
  font-size: 4vw;
  font-weight: 500;
  color: #323233;
}

.q-type {
  font-size: 3.5vw;
  color: #323233;
}

/* 卡片内容 */
.card-body {
  padding: 5vw;
}

.question-text {
  font-size: 4vw;
  color: #323233;
  line-height: 1.7;
  margin-bottom: 5vw;
}

/* 选项列表 */
.options-list {
  display: flex;
  flex-direction: column;
}

.option-row {
  display: flex;
  align-items: center;
  padding: 4vw 0;
  border-bottom: 1px solid #f0f0f0;
}

.option-row:last-child {
  border-bottom: none;
}

.option-letter {
  font-size: 4vw;
  color: #323233;
  width: 6vw;
}

.option-text {
  flex: 1;
  font-size: 4vw;
  color: #323233;
}

.option-icon {
  width: 6vw;
  height: 6vw;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e8e8e8;
  margin-left: 3vw;
}

/* 正确答案 - 蓝色勾 */
.option-row.correct .option-icon {
  background: #0475FA;
}

/* 错误答案 - 红色叉 */
.option-row.wrong .option-icon {
  background: #ee0a24;
}

/* 高亮正确/错误行 */
.option-row.correct {
  background: #f0f7ff;
}

.option-row.wrong {
  background: #fff5f5;
}
</style>
