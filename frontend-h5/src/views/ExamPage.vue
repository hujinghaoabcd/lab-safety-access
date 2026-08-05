<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { formatTime } from '../utils'
import { startExam as startExamApi, submitExam as submitExamApi } from '../api'

const router = useRouter()
const route = useRoute()

interface QuestionOption {
  label: string
  value: string
}

interface Question {
  id: number | string
  type: 'single' | 'multiple' | 'judge'
  content: string
  options: QuestionOption[]
}

const examId = (route.query.examId as string) || ''
const currentIndex = ref(0)
const answers = ref<Record<string, string | string[]>>({})
const remainingTime = ref(60 * 60) // 默认 60 分钟，实际从接口覆盖
const showAnswerCard = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const questions = ref<Question[]>([])

const currentQuestion = computed(() => questions.value[currentIndex.value])

const progress = computed(() => {
  const total = questions.value.length
  if (!total) return 0
  const answered = Object.keys(answers.value).length
  return Math.round((answered / total) * 100)
})

const formattedTime = computed(() => formatTime(remainingTime.value))

const selectAnswer = (option: QuestionOption) => {
  const q = currentQuestion.value
  if (!q) return
  if (q.type === 'multiple') {
    const current = (answers.value[q.id as any] as string[]) || []
    const index = current.indexOf(option.value)
    if (index > -1) {
      current.splice(index, 1)
    } else {
      current.push(option.value)
    }
    answers.value[q.id as any] = [...current]
  } else {
    answers.value[q.id as any] = option.value
  }
}

const isSelected = (option: QuestionOption) => {
  const q = currentQuestion.value
  if (!q) return false
  const answer = answers.value[q.id as any]
  if (Array.isArray(answer)) {
    return (answer as string[]).includes(option.value)
  }
  return answer === option.value
}

const prevQuestion = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

const nextQuestion = () => {
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++
  }
}

const goToQuestion = (index: number) => {
  currentIndex.value = index
  showAnswerCard.value = false
}

const submitExam = async () => {
  const unanswered = questions.value.length - Object.keys(answers.value).length
  
  let message = '确定要交卷吗？'
  if (unanswered > 0) {
    message = `还有 ${unanswered} 题未作答，确定要交卷吗？`
  }
  
  await showConfirmDialog({
    title: '提交试卷',
    message
  })

  try {
    const usedSeconds = Math.max(0, 60 * 60 - remainingTime.value)
    const minutes = Math.floor(usedSeconds / 60)
    const seconds = usedSeconds % 60
    const durationStr = `${minutes}分${seconds}秒`

    const resp: any = await submitExamApi(examId, answers.value as any, durationStr)
    const data = resp?.data ?? resp
    console.log('[Exam] submitExam response:', data)

    router.replace({
      path: '/exam-result',
      query: {
        score: String(data.score ?? 0),
        total: String(data.totalScore ?? 100),
        correct: String(data.correctCount ?? 0),
        wrong: String(data.wrongCount ?? 0),
        passScore: String(data.totalScore ? data.totalScore * 0.6 : 60)
      }
    })
  } catch (err: any) {
    console.error('[Exam] submitExam error:', err)
    showToast(err?.message || '提交考试失败')
  }
}

onMounted(async () => {
  if (!examId) {
    showToast('缺少考试ID')
    router.back()
    return
  }

  try {
    const resp: any = await startExamApi(examId)
    const data = resp?.data ?? resp
    console.log('[Exam] startExam response:', data)

    const exam = data.exam || {}
    const qs = (data.questions || []) as any[]

    questions.value = qs.map((q) => {
      const type: Question['type'] =
        q.type === '多选题' ? 'multiple' : q.type === '判断题' ? 'judge' : 'single'

      let opts: QuestionOption[] = []
      if (type === 'judge') {
        // 判断题：提交“正确 / 错误”，与后端存储的答案一致
        opts = (q.options || []).map((text: string, idx: number) => {
          const letter = String.fromCharCode(65 + idx) // A / B
          return {
            label: `${letter}. ${text}`,
            value: text // 提交给后端的是“正确”或“错误”
          }
        })
      } else {
        // 单选、多选题：提交选项字母 A/B/C/D，与后端答案格式一致
        opts = (q.options || []).map((text: string, idx: number) => {
          const letter = String.fromCharCode(65 + idx)
          return {
            label: `${letter}. ${text}`,
            value: letter
          }
        })
      }

      return {
        id: q.id,
        type,
        content: q.content,
        options: opts
      }
    })

    // 考试时长按接口设置
    if (exam.duration && Number(exam.duration) > 0) {
      remainingTime.value = Number(exam.duration) * 60
    }

    // 启动计时器
    timer = setInterval(() => {
      remainingTime.value--
      if (remainingTime.value <= 0) {
        if (timer) clearInterval(timer)
        showToast('考试时间到，自动提交')
        submitExam()
      }
    }, 1000)
  } catch (err: any) {
    console.error('[Exam] startExam error:', err)
    showToast(err?.message || '加载试题失败')
    router.back()
  }
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<template>
  <div class="exam-page">
    <!-- 顶部计时和进度 -->
    <div class="exam-header">
      <div class="header-row">

        <div class="progress-wrapper">
          <van-progress :percentage="progress" :stroke-width="8" />
        </div>
        <div class="timer" :class="{ warning: remainingTime < 300 }">
          ⏱️ {{ formattedTime }}
        </div>
        <!-- <div class="progress-text">
          {{ Object.keys(answers).length }}/{{ questions.length }}题
        </div> -->
      </div>
    </div>

    <!-- 题目内容 -->
    <div v-if="questions.length" class="question-card">
      <div class="card-header">
        <span class="question-index">{{ currentIndex + 1 }}/{{ questions.length }}</span>
        <van-tag type="primary">
          {{ currentQuestion.type === 'single' ? '单选题' : currentQuestion.type === 'multiple' ? '多选题' : '判断题' }}
        </van-tag>
      </div>
      
      <div class="card-body">
        <div class="question-content">
          {{ currentQuestion?.content }}
        </div>

        <div class="options-list">
          <div
            v-for="option in currentQuestion?.options || []"
            :key="option.value"
            class="option-item"
            :class="{ selected: isSelected(option) }"
            @click="selectAnswer(option)"
          >
            <span class="option-text">{{ option.label }}</span>
            <van-icon v-if="isSelected(option)" name="success" color="#0475FA" />
          </div>
        </div>
      </div>
    </div>
    <div v-else class="question-card">
      <div class="card-body">
        <div class="question-content">
          暂无试题，请联系管理员检查考试配置。
        </div>
      </div>
    </div>

    <!-- 底部答题卡按钮 -->
    <div class="bottom-bar">
      <button class="answer-card-btn" @click="showAnswerCard = true">
        <van-icon name="apps-o" size="5vw" />
        <span>答题卡</span>
      </button>
      <button 
        v-if="currentIndex < questions.length - 1"
        class="next-btn" 
        @click="nextQuestion"
      >
        下一题
      </button>
      <button 
        v-else
        class="submit-btn" 
        @click="submitExam"
      >
        交卷
      </button>
    </div>

    <!-- 答题卡弹出层 -->
    <van-popup
      :show="showAnswerCard"
      @update:show="val => (showAnswerCard = val)"
      position="bottom"
      round
      :style="{ maxHeight: '70vh' }"
    >
      <div class="answer-card-popup">
        <div class="answer-card-grid">
          <div
            v-for="(q, index) in questions"
            :key="q.id"
            class="card-item"
            :class="{
              answered: answers[q.id],
              current: index === currentIndex
            }"
            @click="goToQuestion(index)"
          >
            {{ index + 1 }}
          </div>
        </div>

        <div class="answer-card-legend">
          <div class="legend-item">
            <span class="legend-dot answered"></span>
            <span>已做</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot current"></span>
            <span>当前</span>
          </div>
        </div>

        <button class="card-next-btn" @click="nextQuestion(); showAnswerCard = false">
          下一题
        </button>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.exam-page {
  min-height: 100vh;
  background: #f7f8fa;
  padding: 4vw;
  padding-bottom: 25vw;
}

/* 顶部计时和进度 */
.exam-header {
  background: #fff;
  padding: 4vw;
  margin-bottom: 4vw;
}

.header-row {
  display: flex;
  align-items: center;
  gap: 3vw;
}

.timer {
  font-size: 4vw;
  font-weight: 600;
  color: #323233;
  white-space: nowrap;
}

.timer.warning {
  color: #ee0a24;
  animation: blink 1s infinite;
}

@keyframes blink {
  50% { opacity: 0.5; }
}

.progress-wrapper {
  flex: 1;
}

.progress-text {
  font-size: 3.2vw;
  color: #969799;
  white-space: nowrap;
}

/* 题目卡片 */
.question-card {
  background: #fff;
  margin-bottom: 4vw;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 4vw;
  padding: 4vw 5vw;
  border-bottom: 1px solid #eee;
}

.question-index {
  font-size: 4vw;
  font-weight: 500;
  color: #323233;
}

.card-body {
  padding: 5vw;
}

.question-content {
  font-size: 4vw;
  color: #323233;
  line-height: 1.8;
  margin-bottom: 5vw;
}

/* 选项列表 */
.options-list {
  display: flex;
  flex-direction: column;
  gap: 3.2vw;
}

.option-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4vw;
  background: #f7f8fa;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.option-item.selected {
  background: #e8f4ff;
  border-color: #0475FA;
}

.option-text {
  font-size: 3.733vw;
  color: #323233;
  line-height: 1.5;
}

/* 底部栏 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  padding: 3vw 4vw;
  background: #fff;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  gap: 3vw;
}

.answer-card-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2vw 4vw;
  background: #f5f5f5;
  border: none;
  color: #666;
  font-size: 2.8vw;
  gap: 1vw;
}

.next-btn, .submit-btn {
  flex: 1;
  padding: 3.5vw;
  border: none;
  font-size: 4vw;
  font-weight: 600;
  color: #fff;
}

.next-btn {
  background: #0475FA;
}

.submit-btn {
  background: #ee0a24;
}

/* 答题卡弹出层 */
.answer-card-popup {
  padding: 5vw;
}

.answer-card-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 3vw;
  margin-bottom: 5vw;
}

.card-item {
  width: 12vw;
  height: 12vw;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 4vw;
  font-weight: 500;
  background: #f5f5f5;
  color: #999;
  border: 2px solid transparent;
}

.card-item.answered {
  background: #0475FA;
  color: #fff;
}

.card-item.current {
  background: #fff;
  border-color: #0475FA;
  color: #0475FA;
}

.answer-card-legend {
  display: flex;
  justify-content: center;
  gap: 8vw;
  margin-bottom: 5vw;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 2vw;
  font-size: 3.2vw;
  color: #666;
}

.legend-dot {
  width: 4vw;
  height: 4vw;
  border-radius: 50%;
}

.legend-dot.answered {
  background: #0475FA;
}

.legend-dot.current {
  background: #fff;
  border: 2px solid #0475FA;
}

.card-next-btn {
  width: 100%;
  padding: 3.5vw;
  background: #0475FA;
  border: none;
  color: #fff;
  font-size: 4vw;
  font-weight: 600;
}
</style>
