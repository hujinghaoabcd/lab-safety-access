<template>
  <div class="desktop-exam">
    <!-- 顶部工具栏 -->
    <div class="exam-toolbar">
      <div class="toolbar-left">
        <div class="progress-info">
          <span class="progress-label">答题进度</span>
          <span class="progress-value">{{ Object.keys(answers).length }}/{{ questions.length }}题</span>
        </div>
        <el-progress :percentage="progress" :color="progressColor" :stroke-width="8" style="width: 200px" />
      </div>
      <div class="toolbar-right">
        <div class="timer" :class="{ warning: remainingTime < 300 }">
          <el-icon><Timer /></el-icon>
          <span>{{ formattedTime }}</span>
        </div>
        <el-button size="small" @click="showAnswerCard = true">
          <el-icon><Grid /></el-icon>
          答题卡
        </el-button>
      </div>
    </div>

    <!-- 题目区域 -->
    <div class="exam-content">
      <el-row :gutter="16">
        <!-- 左侧题目 -->
        <el-col :span="17">
          <div class="question-panel" v-if="questions.length">
            <div class="question-header">
              <span class="question-num">第 {{ currentIndex + 1 }} 题 / 共 {{ questions.length }} 题</span>
              <el-tag :type="getQuestionTypeTag(currentQuestion?.type)" size="small">
                {{ getQuestionTypeText(currentQuestion?.type) }}
              </el-tag>
            </div>

            <div class="question-body">
              <div class="question-text">{{ currentQuestion?.content }}</div>
              <div class="options">
                <div
                  v-for="option in currentQuestion?.options || []"
                  :key="option.value"
                  class="option-item"
                  :class="{ selected: isSelected(option) }"
                  @click="selectAnswer(option)"
                >
                  <span class="option-check">
                    <el-icon v-if="isSelected(option)"><Check /></el-icon>
                  </span>
                  <span class="option-text">{{ option.label }}</span>
                </div>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无试题" />
        </el-col>

        <!-- 右侧导航 -->
        <el-col :span="7">
          <div class="nav-panel">
            <div class="nav-title">题目导航</div>
            <div class="nav-grid">
              <div
                v-for="(q, index) in questions"
                :key="q.id"
                class="nav-item"
                :class="{ answered: answers[q.id], current: index === currentIndex }"
                @click="goToQuestion(index)"
              >
                {{ index + 1 }}
              </div>
            </div>
            <div class="nav-legend">
              <div class="legend-item"><span class="dot answered"></span>已答</div>
              <div class="legend-item"><span class="dot current"></span>当前</div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 底部操作栏 -->
    <div class="exam-footer">
      <el-button :disabled="currentIndex === 0" @click="prevQuestion">
        <el-icon><ArrowLeft /></el-icon>
        上一题
      </el-button>
      <el-button v-if="currentIndex < questions.length - 1" type="primary" @click="nextQuestion">
        下一题
        <el-icon><ArrowRight /></el-icon>
      </el-button>
      <el-button v-else type="danger" @click="submitExam">
        提交试卷
      </el-button>
    </div>

    <!-- 答题卡对话框 -->
    <el-dialog v-model="showAnswerCard" title="答题卡" width="600px">
      <div class="answer-card-grid">
        <div
          v-for="(q, index) in questions"
          :key="q.id"
          class="card-item"
          :class="{ answered: answers[q.id], current: index === currentIndex }"
          @click="goToQuestion(index)"
        >
          {{ index + 1 }}
        </div>
      </div>
      <div class="card-legend">
        <div class="legend-item"><span class="dot answered"></span>已答</div>
        <div class="legend-item"><span class="dot current"></span>当前</div>
      </div>
      <template #footer>
        <el-button @click="showAnswerCard = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Timer, Grid, Check, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { formatTime } from '@/utils'
import { startExam as startExamApi, submitExam as submitExamApi } from '@/api'

const router = useRouter()
const route = useRoute()

interface QuestionOption { label: string; value: string }
interface Question { id: number | string; type: 'single' | 'multiple' | 'judge'; content: string; options: QuestionOption[] }

const examId = (route.query.examId as string) || ''
const currentIndex = ref(0)
const answers = ref<Record<string, string | string[]>>({})
const remainingTime = ref(60 * 60)
const showAnswerCard = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const questions = ref<Question[]>([])
const currentQuestion = computed(() => questions.value[currentIndex.value])

const progress = computed(() => {
  const total = questions.value.length
  if (!total) return 0
  return Math.round((Object.keys(answers.value).length / total) * 100)
})

const progressColor = computed(() => {
  if (progress.value < 50) return '#909399'
  if (progress.value < 80) return '#e6a23c'
  return '#67c23a'
})

const formattedTime = computed(() => formatTime(remainingTime.value))

const getQuestionTypeText = (type?: string) => {
  const map: Record<string, string> = { single: '单选题', multiple: '多选题', judge: '判断题' }
  return map[type || ''] || '未知'
}

const getQuestionTypeTag = (type?: string) => {
  const map: Record<string, string> = { single: 'primary', multiple: 'success', judge: 'warning' }
  return map[type || ''] || 'info'
}

const selectAnswer = (option: QuestionOption) => {
  const q = currentQuestion.value
  if (!q) return
  if (q.type === 'multiple') {
    const current = (answers.value[q.id as any] as string[]) || []
    const index = current.indexOf(option.value)
    if (index > -1) current.splice(index, 1)
    else current.push(option.value)
    answers.value[q.id as any] = [...current]
  } else {
    answers.value[q.id as any] = option.value
  }
}

const isSelected = (option: QuestionOption) => {
  const q = currentQuestion.value
  if (!q) return false
  const answer = answers.value[q.id as any]
  return Array.isArray(answer) ? answer.includes(option.value) : answer === option.value
}

const prevQuestion = () => { if (currentIndex.value > 0) currentIndex.value-- }
const nextQuestion = () => { if (currentIndex.value < questions.value.length - 1) currentIndex.value++ }
const goToQuestion = (index: number) => { currentIndex.value = index; showAnswerCard.value = false }

const submitExam = async () => {
  const unanswered = questions.value.length - Object.keys(answers.value).length
  const message = unanswered > 0 ? `还有 ${unanswered} 题未作答，确定要交卷吗？` : '确定要交卷吗？'

  try {
    await ElMessageBox.confirm(message, '提交试卷', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })

    const usedSeconds = Math.max(0, 60 * 60 - remainingTime.value)
    const durationStr = `${Math.floor(usedSeconds / 60)}分${usedSeconds % 60}秒`

    const resp: any = await submitExamApi(examId, answers.value as any, durationStr)
    const data = resp?.data ?? resp

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
    if (err !== 'cancel') ElMessage.error(err?.message || '提交考试失败')
  }
}

onMounted(async () => {
  if (!examId) {
    ElMessage.error('缺少考试ID')
    router.back()
    return
  }

  try {
    const resp: any = await startExamApi(examId)
    const data = resp?.data ?? resp
    const exam = data.exam || {}
    const qs = (data.questions || []) as any[]

    questions.value = qs.map((q) => {
      const type: Question['type'] = q.type === '多选题' ? 'multiple' : q.type === '判断题' ? 'judge' : 'single'
      const opts: QuestionOption[] = (q.options || []).map((text: string, idx: number) => {
        const letter = String.fromCharCode(65 + idx)
        return { label: `${letter}. ${text}`, value: type === 'judge' ? text : letter }
      })
      return { id: q.id, type, content: q.content, options: opts }
    })

    if (exam.duration && Number(exam.duration) > 0) remainingTime.value = Number(exam.duration) * 60

    timer = setInterval(() => {
      remainingTime.value--
      if (remainingTime.value <= 0) {
        if (timer) clearInterval(timer)
        ElMessage.warning('考试时间到，自动提交')
        submitExam()
      }
    }, 1000)
  } catch (err: any) {
    ElMessage.error(err?.message || '加载试题失败')
    router.back()
  }
})

onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<style scoped>
.desktop-exam {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 100px);
}

/* 工具栏 */
.exam-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.progress-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-label {
  font-size: 12px;
  color: #909399;
}

.progress-value {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.timer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #f0f7ff;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 600;
  color: #0475FA;
}

.timer.warning {
  background: #fef0f0;
  color: #f56c6c;
}

.timer .el-icon {
  font-size: 18px;
}

/* 题目区域 */
.exam-content {
  flex: 1;
  margin-bottom: 16px;
}

.question-panel {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  min-height: 480px;
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
}

.question-num {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.question-body {
  padding: 24px;
}

.question-text {
  font-size: 16px;
  color: #303133;
  line-height: 1.8;
  margin-bottom: 24px;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.option-item:hover {
  border-color: #0475FA;
  background: #f0f7ff;
}

.option-item.selected {
  border-color: #0475FA;
  background: #ecf5ff;
}

.option-check {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.option-item.selected .option-check {
  background: #0475FA;
  border-color: #0475FA;
  color: #fff;
}

.option-text {
  font-size: 14px;
  color: #303133;
  line-height: 1.5;
}

/* 导航面板 */
.nav-panel {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 80px;
}

.nav-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.nav-item {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  background: #f5f7fa;
  color: #909399;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-item:hover {
  border: 1px solid #0475FA;
  color: #0475FA;
}

.nav-item.answered {
  background: #0475FA;
  color: #fff;
}

.nav-item.current {
  border: 2px solid #0475FA;
  color: #0475FA;
  background: #fff;
}

.nav-legend {
  display: flex;
  justify-content: center;
  gap: 20px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #909399;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.dot.answered {
  background: #0475FA;
}

.dot.current {
  border: 2px solid #0475FA;
  background: #fff;
}

/* 底部操作栏 */
.exam-footer {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 16px 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.exam-footer .el-button {
  min-width: 120px;
}

/* 答题卡对话框 */
.answer-card-grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.card-item {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  background: #f5f7fa;
  color: #909399;
  cursor: pointer;
  transition: all 0.2s;
}

.card-item.answered {
  background: #0475FA;
  color: #fff;
}

.card-item.current {
  border: 2px solid #0475FA;
  color: #0475FA;
  background: #fff;
}

.card-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}
</style>
