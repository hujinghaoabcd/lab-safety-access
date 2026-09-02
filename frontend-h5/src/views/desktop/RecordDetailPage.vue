<template>
  <div class="desktop-record-detail">
    <section class="record-summary">
      <div class="summary-main">
        <div class="summary-title-wrap">
          <strong class="exam-title">{{ recordInfo.examTitle || '考试详情' }}</strong>
          <el-tag :type="recordInfo.passed ? 'success' : 'danger'" effect="plain">
            {{ recordInfo.passed ? '通过' : '未通过' }}
          </el-tag>
        </div>
        <div class="summary-score" :class="{ failed: !recordInfo.passed }">
          <strong>{{ recordInfo.score }}</strong>
          <span>/ {{ recordInfo.totalScore || 0 }}</span>
        </div>
      </div>

      <div class="summary-meta">
        <div class="meta-item">
          <span>答对</span>
          <strong class="success-text">{{ recordInfo.correctCount }} 题</strong>
        </div>
        <div class="meta-item">
          <span>答错</span>
          <strong class="danger-text">{{ recordInfo.wrongCount }} 题</strong>
        </div>
        <div class="meta-item">
          <span>用时</span>
          <strong>{{ recordInfo.duration || '-' }}</strong>
        </div>
        <div class="meta-item submit-time">
          <span>提交时间</span>
          <strong>{{ recordInfo.submitTime || '-' }}</strong>
        </div>
      </div>
    </section>

    <section class="questions-panel">
      <div class="panel-toolbar">
        <div class="toolbar-title">
          <strong>答题详情</strong>
          <span>共 {{ questions.length }} 题</span>
        </div>

        <el-radio-group v-model="showOnlyWrong" size="default">
          <el-radio-button :label="false">全部 {{ questions.length }}</el-radio-button>
          <el-radio-button :label="true">错题 {{ wrongQuestionsCount }}</el-radio-button>
        </el-radio-group>
      </div>

      <div v-if="loading" class="loading-state">加载中...</div>

      <div v-else-if="filteredQuestions.length === 0" class="empty-state">
        <div class="empty-icon"><el-icon><CircleCheck /></el-icon></div>
        <div class="empty-title">暂无错题</div>
        <div class="empty-desc">本次考试当前筛选条件下没有题目</div>
      </div>

      <template v-else>
        <div class="questions-list">
          <article
            v-for="item in pagedQuestions"
            :key="item.question.id"
            class="question-item"
            :class="{ 'wrong-question': !item.question.isCorrect }"
          >
            <div class="question-head">
              <div class="question-meta">
                <strong>第 {{ item.number }} 题</strong>
                <el-tag :type="getTypeTag(item.question.type)" effect="plain">
                  {{ getTypeLabel(item.question.type) }}
                </el-tag>
                <el-tag :type="item.question.isCorrect ? 'success' : 'danger'" effect="dark">
                  {{ item.question.isCorrect ? '正确' : '错误' }}
                </el-tag>
              </div>
              <span class="question-result" :class="item.question.isCorrect ? 'success-text' : 'danger-text'">
                {{ item.question.isCorrect ? '作答正确' : '作答错误' }}
              </span>
            </div>

            <div class="question-body">
              <div class="question-content">{{ item.question.content }}</div>

              <div class="options-list">
                <div
                  v-for="opt in item.question.options"
                  :key="opt"
                  class="option-item"
                  :class="getOptionClass(item.question, opt)"
                >
                  <span class="option-mark">
                    <el-icon v-if="getOptionStatus(item.question, opt) === 'correct'"><Check /></el-icon>
                    <el-icon v-else-if="getOptionStatus(item.question, opt) === 'wrong'"><Close /></el-icon>
                  </span>
                  <strong class="option-letter">{{ opt.charAt(0) }}.</strong>
                  <span class="option-text">{{ opt.substring(3) }}</span>
                </div>
              </div>

              <div class="answer-summary">
                <div class="answer-item">
                  <span>你的答案</span>
                  <strong :class="item.question.isCorrect ? 'success-text' : 'danger-text'">
                    {{ formatAnswer(item.question.userAnswer) }}
                  </strong>
                </div>
                <div class="answer-item">
                  <span>正确答案</span>
                  <strong class="success-text">{{ item.question.correctAnswer || '-' }}</strong>
                </div>
              </div>
            </div>
          </article>
        </div>

        <div class="pagination-row">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50]"
            :total="filteredQuestions.length"
            layout="total, sizes, prev, pager, next, jumper"
            background
          />
        </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { TagProps } from 'element-plus'
import { Check, CircleCheck, Close } from '@element-plus/icons-vue'
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
const loading = ref(false)
const showOnlyWrong = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)

const wrongQuestionsCount = computed(() => questions.value.filter(q => !q.isCorrect).length)

const filteredQuestions = computed(() => {
  return questions.value
    .map((question, index) => ({ question, number: index + 1 }))
    .filter(item => !showOnlyWrong.value || !item.question.isCorrect)
})

const pagedQuestions = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredQuestions.value.slice(start, start + pageSize.value)
})

watch([showOnlyWrong, pageSize], () => {
  currentPage.value = 1
})

watch(filteredQuestions, () => {
  const maxPage = Math.max(1, Math.ceil(filteredQuestions.value.length / pageSize.value))
  if (currentPage.value > maxPage) currentPage.value = maxPage
})

const getTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    single: '单选题',
    multiple: '多选题',
    judge: '判断题',
    '单选题': '单选题',
    '多选题': '多选题',
    '判断题': '判断题'
  }
  return map[type] || type || '题目'
}

const getTypeTag = (type: string): TagProps['type'] => {
  const map: Record<string, TagProps['type']> = {
    single: 'primary',
    multiple: 'success',
    judge: 'warning',
    '单选题': 'primary',
    '多选题': 'success',
    '判断题': 'warning'
  }
  return map[type] || 'info'
}

const normalizeAnswer = (answer: string | string[]) => {
  if (Array.isArray(answer)) return answer.map(String)
  const text = String(answer || '').trim()
  if (!text) return []
  return text.includes(',') ? text.split(',').map(item => item.trim()).filter(Boolean) : [text]
}

const formatAnswer = (answer: string | string[]) => {
  const normalized = normalizeAnswer(answer)
  return normalized.length ? normalized.join('、') : '未作答'
}

const getOptionStatus = (q: QuestionResult, opt: string) => {
  const letter = opt.charAt(0)
  const text = opt.substring(3)
  const userAnswers = normalizeAnswer(q.userAnswer)
  const correctAnswer = String(q.correctAnswer || '')

  const isUserAnswer = userAnswers.some(answer => answer === letter || answer === text)
  const isCorrectAnswer = correctAnswer.includes(letter) || correctAnswer === text

  if (isCorrectAnswer) return 'correct'
  if (isUserAnswer) return 'wrong'
  return 'default'
}

const getOptionClass = (q: QuestionResult, opt: string) => {
  const status = getOptionStatus(q, opt)
  return {
    'is-correct': status === 'correct',
    'is-wrong': status === 'wrong'
  }
}

onMounted(async () => {
  if (!recordId) {
    ElMessage.error('缺少记录ID')
    router.back()
    return
  }

  try {
    loading.value = true
    const resp: any = await getRecordDetail(recordId)
    const data = resp?.data ?? resp

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
      isCorrect: Boolean(q.isCorrect)
    }))

    questions.value = qs
    recordInfo.value.correctCount = qs.filter(q => q.isCorrect).length
    recordInfo.value.wrongCount = qs.length - recordInfo.value.correctCount
  } catch (err: any) {
    ElMessage.error(err?.message || '加载考试详情失败')
    router.back()
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.desktop-record-detail {
  padding: 0;
}

.record-summary,
.questions-panel {
  background: #fff;
  border: 1px solid #e5eaf2;
}

.record-summary {
  margin-bottom: 16px;
}

.summary-main {
  min-height: 62px;
  padding: 0 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e5eaf2;
}

.summary-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.exam-title {
  font-size: 18px;
  color: #1f2d3d;
}

.summary-title-wrap :deep(.el-tag),
.question-meta :deep(.el-tag) {
  border-radius: 0;
}

.summary-score {
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: #2fa34e;
}

.summary-score.failed {
  color: #e95b67;
}

.summary-score strong {
  font-size: 26px;
  line-height: 1;
}

.summary-score span {
  font-size: 13px;
  color: #98a3b3;
}

.summary-meta {
  display: grid;
  grid-template-columns: 150px 150px 180px minmax(280px, 1fr);
  min-height: 58px;
}

.meta-item {
  padding: 0 22px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-right: 1px solid #e5eaf2;
}

.meta-item:last-child {
  border-right: 0;
}

.meta-item span {
  font-size: 13px;
  color: #8a97a8;
}

.meta-item strong {
  font-size: 15px;
  color: #334155;
  font-weight: 600;
}

.success-text {
  color: #2f9e4d !important;
}

.danger-text {
  color: #e95b67 !important;
}

.panel-toolbar {
  min-height: 54px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid #e5eaf2;
}

.toolbar-title {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.toolbar-title strong {
  font-size: 17px;
  color: #1f2d3d;
}

.toolbar-title span {
  font-size: 13px;
  color: #8a97a8;
}

.panel-toolbar :deep(.el-radio-button__inner) {
  min-width: 78px;
  height: 30px;
  padding: 6px 12px;
  line-height: 16px;
  border-radius: 0 !important;
  font-size: 13px;
}

.questions-list {
  padding: 14px 20px 0;
  background: #f4f6f9;
}

.question-item {
  margin-bottom: 14px;
  background: #fff;
  border: 1px solid #dfe5ec;
}

.question-item.wrong-question {
  border-color: #efc9cd;
}

.question-head {
  min-height: 48px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f7f9fb;
  border-bottom: 1px solid #e7ebf0;
}

.wrong-question .question-head {
  background: #fff7f7;
}

.question-meta {
  display: flex;
  align-items: center;
  gap: 9px;
}

.question-meta > strong {
  min-width: 64px;
  font-size: 15px;
  color: #273444;
}

.question-meta :deep(.el-tag) {
  height: 25px;
  padding: 0 9px;
  font-size: 12px;
}

.question-result {
  font-size: 13px;
  font-weight: 500;
}

.question-body {
  padding: 18px 20px 20px;
}

.question-content {
  margin-bottom: 14px;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.7;
  color: #273444;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-item {
  min-height: 42px;
  padding: 9px 12px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #f6f8fb;
  border: 1px solid #edf0f4;
  color: #59677a;
  font-size: 14px;
  line-height: 1.55;
}

.option-item.is-correct {
  background: #f1f8f2;
  border-color: #b8dfc2;
}

.option-item.is-wrong {
  background: #fff4f4;
  border-color: #efc3c7;
}

.option-mark {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
  color: #9aa5b4;
}

.option-item.is-correct .option-mark {
  color: #2f9e4d;
}

.option-item.is-wrong .option-mark {
  color: #e95b67;
}

.option-letter {
  flex: 0 0 auto;
  color: #334155;
}

.option-text {
  flex: 1;
}

.answer-summary {
  margin-top: 14px;
  padding-top: 12px;
  display: flex;
  align-items: center;
  gap: 30px;
  border-top: 1px solid #e8edf3;
}

.answer-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.answer-item span {
  font-size: 13px;
  color: #8a97a8;
}

.answer-item strong {
  font-size: 14px;
}

.pagination-row {
  min-height: 58px;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  border-top: 1px solid #e5eaf2;
  background: #fafbfd;
}

.pagination-row :deep(.el-pagination button),
.pagination-row :deep(.el-pager li),
.pagination-row :deep(.el-input__wrapper),
.pagination-row :deep(.el-select__wrapper) {
  border-radius: 0 !important;
}

.loading-state {
  padding: 70px 0;
  text-align: center;
  color: #909399;
}

.empty-state {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  background: #eef8f1;
  color: #35a854;
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

@media (max-width: 1100px) {
  .summary-meta {
    grid-template-columns: repeat(2, 1fr);
  }

  .meta-item:nth-child(2) {
    border-right: 0;
  }

  .meta-item {
    min-height: 52px;
    border-bottom: 1px solid #e5eaf2;
  }

  .panel-toolbar {
    padding: 12px 16px;
  }
}
</style>
