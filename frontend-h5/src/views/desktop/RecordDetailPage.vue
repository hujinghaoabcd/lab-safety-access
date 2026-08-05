<template>
  <div class="desktop-record-detail">
    <el-card class="page-header" shadow="never">
      <h2>考试详情</h2>
      <p>{{ recordInfo.examTitle }}</p>
    </el-card>

    <!-- 统计信息 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <el-icon class="stat-icon" style="color: #07c160;"><CircleCheck /></el-icon>
            <div class="stat-value success">{{ recordInfo.correctCount }}题</div>
            <div class="stat-label">答对</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <el-icon class="stat-icon" style="color: #f56c6c;"><CircleClose /></el-icon>
            <div class="stat-value error">{{ recordInfo.wrongCount }}题</div>
            <div class="stat-label">答错</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <el-icon class="stat-icon" style="color: #FF9500;"><Trophy /></el-icon>
            <div class="stat-value score">{{ recordInfo.score }}分</div>
            <div class="stat-label">得分</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <el-icon class="stat-icon" style="color: #0475FA;"><Clock /></el-icon>
            <div class="stat-value">{{ recordInfo.duration }}</div>
            <div class="stat-label">用时</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选栏 -->
    <el-card class="filter-card" shadow="hover">
      <el-radio-group v-model="showOnlyWrong" size="large">
        <el-radio-button :label="false">全部题目 ({{ questions.length }})</el-radio-button>
        <el-radio-button :label="true">只看错题 ({{ questions.filter(q => !q.isCorrect).length }})</el-radio-button>
      </el-radio-group>
    </el-card>

    <!-- 题目列表 -->
    <div class="questions-list">
      <el-card
        v-for="(q, index) in filteredQuestions"
        :key="q.id"
        class="question-card"
        shadow="hover"
        :class="{ 'wrong-question': !q.isCorrect }"
      >
        <div class="question-header">
          <div class="question-meta">
            <span class="question-number">第 {{ index + 1 }} 题</span>
            <el-tag :type="getTypeTag(q.type)">
              {{ q.type === 'single' ? '单选题' : q.type === 'multiple' ? '多选题' : '判断题' }}
            </el-tag>
            <el-tag v-if="q.isCorrect" type="success" effect="dark">✓ 正确</el-tag>
            <el-tag v-else type="danger" effect="dark">✗ 错误</el-tag>
          </div>
        </div>

        <div class="question-body">
          <div class="question-content">{{ q.content }}</div>

          <div class="options-list">
            <div
              v-for="opt in q.options"
              :key="opt"
              class="option-item"
              :class="getOptionClass(q, opt)"
            >
              <div class="option-status">
                <el-icon v-if="getOptionStatus(q, opt) === 'correct'"><Check /></el-icon>
                <el-icon v-else-if="getOptionStatus(q, opt) === 'wrong'"><Close /></el-icon>
              </div>
              <span class="option-letter">{{ opt.charAt(0) }}</span>
              <span class="option-text">{{ opt.substring(3) }}</span>
            </div>
          </div>

          <div v-if="!q.isCorrect" class="correct-answer-hint">
            <el-alert
              :title="`正确答案：${q.correctAnswer}`"
              type="success"
              :closable="false"
              show-icon
            />
          </div>
        </div>
      </el-card>
    </div>

    <el-empty v-if="filteredQuestions.length === 0" description="暂无题目" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CircleCheck, CircleClose, Trophy, Clock, Check, Close } from '@element-plus/icons-vue'
import { getRecordDetail } from '@/api'

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

const getTypeTag = (type: string) => {
  const map: Record<string, string> = {
    single: 'primary',
    multiple: 'success',
    judge: 'warning'
  }
  return map[type] || 'info'
}

const getOptionStatus = (q: QuestionResult, opt: string) => {
  const optLetter = opt.charAt(0)
  const userAns = q.userAnswer
  const correctAns = q.correctAnswer

  const isUserAnswer = Array.isArray(userAns)
    ? userAns.includes(optLetter)
    : userAns === optLetter || userAns === opt.substring(3)

  const isCorrectAnswer = correctAns.includes(optLetter) || correctAns === opt.substring(3)

  if (isCorrectAnswer) {
    return 'correct'
  } else if (isUserAnswer && !q.isCorrect) {
    return 'wrong'
  }
  return 'default'
}

const getOptionClass = (q: QuestionResult, opt: string) => {
  const status = getOptionStatus(q, opt)
  return {
    'is-correct': status === 'correct',
    'is-wrong': status === 'wrong',
    'is-user-answer': Array.isArray(q.userAnswer)
      ? q.userAnswer.includes(opt.charAt(0))
      : q.userAnswer === opt.charAt(0) || q.userAnswer === opt.substring(3)
  }
}

onMounted(async () => {
  if (!recordId) {
    ElMessage.error('缺少记录ID')
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
    ElMessage.error(err?.message || '加载考试详情失败')
    router.back()
  }
})
</script>

<style scoped>
.desktop-record-detail {
  padding: 0;
}

.page-header {
  margin-bottom: 24px;
  border-radius: 16px;
  background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
  border: 1px solid rgba(0, 0, 0, 0.05);
  padding: 24px 32px;
}

.page-header h2 {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 8px 0;
  letter-spacing: 0.5px;
  background: linear-gradient(135deg, #0475FA 0%, #1a8cff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-header p {
  font-size: 15px;
  color: #606266;
  margin: 0;
  font-weight: 500;
}

.stats-row {
  margin-bottom: 24px;
}

.stat-card {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
}

.stat-content {
  text-align: center;
  padding: 24px;
}

.stat-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
  color: #303133;
}

.stat-value.success {
  color: #07c160;
}

.stat-value.error {
  color: #f56c6c;
}

.stat-value.score {
  background: linear-gradient(135deg, #FF9500 0%, #FFB800 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 32px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  font-weight: 500;
}

.filter-card {
  margin-bottom: 24px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  padding: 20px;
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.question-card {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border: 2px solid #ebeef5;
  transition: all 0.3s ease;
}

.question-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
}

.question-card.wrong-question {
  border-color: #fde2e2;
  background: linear-gradient(135deg, #fff 0%, #fff5f5 100%);
}

.question-header {
  padding: 20px 24px;
  border-bottom: 2px solid #f0f2f5;
  background: linear-gradient(135deg, #f8f9fa 0%, #f0f2f5 100%);
}

.question-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.question-number {
  font-size: 18px;
  font-weight: 700;
  color: #303133;
}

.question-body {
  padding: 32px;
}

.question-content {
  font-size: 18px;
  color: #303133;
  line-height: 1.8;
  margin-bottom: 24px;
  font-weight: 500;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #eef2f5 100%);
  border: 2px solid transparent;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.option-item.is-correct {
  background: linear-gradient(135deg, #e6f4ff 0%, #d0e9ff 100%);
  border-color: #0475FA;
}

.option-item.is-wrong {
  background: linear-gradient(135deg, #fff0f0 0%, #ffe8e8 100%);
  border-color: #f56c6c;
}

.option-status {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.option-item.is-correct .option-status {
  background: #0475FA;
  color: #fff;
}

.option-item.is-wrong .option-status {
  background: #f56c6c;
  color: #fff;
}

.option-letter {
  font-size: 16px;
  font-weight: 700;
  color: #606266;
  min-width: 24px;
}

.option-text {
  flex: 1;
  font-size: 16px;
  color: #303133;
  line-height: 1.6;
}

.correct-answer-hint {
  margin-top: 20px;
}

:deep(.el-radio-group) {
  width: 100%;
  display: flex;
  gap: 12px;
}

:deep(.el-radio-button__inner) {
  border-radius: 10px;
  font-weight: 600;
}
</style>

