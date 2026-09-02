<template>
  <div class="desktop-exam-info" v-loading="loading">
    <section class="exam-overview">
      <div class="overview-head">
        <div>
          <div class="overview-kicker">考试说明</div>
          <h1>{{ examInfo.name || '实验室安全考试' }}</h1>
        </div>
        <div class="overview-note">请确认考试信息并阅读考试须知后开始答题</div>
      </div>

      <div class="exam-meta-grid">
        <div class="meta-item duration">
          <span class="meta-icon"><el-icon><Clock /></el-icon></span>
          <div class="meta-content">
            <span class="meta-label">考试时长</span>
            <strong class="meta-value">{{ examInfo.duration }}<small>分钟</small></strong>
          </div>
        </div>

        <div class="meta-item questions">
          <span class="meta-icon"><el-icon><Document /></el-icon></span>
          <div class="meta-content">
            <span class="meta-label">题目数量</span>
            <strong class="meta-value">{{ examInfo.questionCount }}<small>题</small></strong>
          </div>
        </div>

        <div class="meta-item pass-score">
          <span class="meta-icon"><el-icon><Trophy /></el-icon></span>
          <div class="meta-content">
            <span class="meta-label">及格分数</span>
            <strong class="meta-value">{{ examInfo.passScore }}<small>分</small></strong>
          </div>
        </div>

        <div class="meta-item total-score">
          <span class="meta-icon"><el-icon><Star /></el-icon></span>
          <div class="meta-content">
            <span class="meta-label">试卷满分</span>
            <strong class="meta-value">{{ examInfo.totalScore }}<small>分</small></strong>
          </div>
        </div>
      </div>
    </section>

    <section class="rules-panel">
      <div class="panel-head">
        <div class="panel-title">
          <el-icon><InfoFilled /></el-icon>
          <strong>考试须知</strong>
        </div>
        <span v-if="examInfo.rules.length">共 {{ examInfo.rules.length }} 条</span>
      </div>

      <div v-if="examInfo.rules.length > 0" class="rules-list">
        <div
          v-for="(rule, index) in examInfo.rules"
          :key="index"
          class="rule-item"
        >
          <span class="rule-number">{{ index + 1 }}</span>
          <span class="rule-text">{{ rule }}</span>
        </div>
      </div>

      <div v-else class="empty-rules">暂无考试须知</div>
    </section>

    <section class="confirm-panel">
      <el-checkbox v-model="agreed" class="agreement-checkbox">
        <span class="agreement-text">我已阅读并理解以上考试须知，同意开始考试</span>
      </el-checkbox>

      <div class="action-buttons">
        <el-button @click="router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <el-button
          type="primary"
          :disabled="!agreed"
          @click="handleStartExam"
        >
          开始考试
          <el-icon><Right /></el-icon>
        </el-button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  Clock,
  Document,
  InfoFilled,
  Right,
  Star,
  Trophy
} from '@element-plus/icons-vue'
import { getExamDetail } from '@/api'

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
  if (!agreed.value) {
    ElMessage.warning('请先阅读并同意考试须知')
    return
  }

  try {
    await ElMessageBox.confirm('确定要开始考试吗？考试开始后计时器将启动。', '开始考试', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    router.push({
      path: '/exam',
      query: { examId: examInfo.value.id }
    })
  } catch {
    // 用户取消
  }
}

onMounted(async () => {
  if (!examId) {
    ElMessage.error('缺少考试ID')
    router.back()
    return
  }

  try {
    loading.value = true
    const resp: any = await getExamDetail(examId)
    const data = resp?.data ?? resp

    examInfo.value.id = String(data.id)
    examInfo.value.name = data.name || '实验室安全考试'
    examInfo.value.description = data.description || ''
    examInfo.value.duration = Number(data.duration || 0)
    examInfo.value.questionCount = Number(data.questionCount || 0)
    examInfo.value.passScore = Number(data.passScore || 0)
    examInfo.value.totalScore = Number(data.totalScore || 100)

    examInfo.value.rules = (examInfo.value.description || '')
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
  } catch (err: any) {
    console.error('[ExamInfo] getExamDetail error:', err)
    ElMessage.error(err?.message || '加载考试信息失败')
    router.back()
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.desktop-exam-info {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 0;
}

.exam-overview,
.rules-panel,
.confirm-panel {
  background: #fff;
  border: 1px solid #e2e7ee;
  box-shadow: 0 3px 12px rgba(31, 45, 61, 0.06);
}

.overview-head {
  min-height: 82px;
  padding: 17px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  border-bottom: 1px solid #e8ecf2;
}

.overview-kicker {
  margin-bottom: 4px;
  color: #0475FA;
  font-size: 12px;
  font-weight: 600;
}

.overview-head h1 {
  margin: 0;
  color: #1f2d3d;
  font-size: 22px;
  line-height: 1.3;
  font-weight: 700;
}

.overview-note {
  color: #8a97a8;
  font-size: 13px;
  white-space: nowrap;
}

.exam-meta-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 20px 24px 22px;
  gap: 16px;
}

.meta-item {
  min-width: 0;
  height: 76px;
  padding: 13px 16px;
  display: flex;
  align-items: center;
  gap: 13px;
  background: #f7f9fc;
  border: 1px solid #e7ebf0;
}

.meta-icon {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
}

.duration .meta-icon {
  background: #fff0f0;
  color: #e95b67;
}

.questions .meta-icon {
  background: #e9f8f6;
  color: #28a99d;
}

.pass-score .meta-icon {
  background: #fff7df;
  color: #d99a16;
}

.total-score .meta-icon {
  background: #e9f7f4;
  color: #2ba894;
}

.meta-content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  color: #8f9aaa;
  font-size: 12px;
}

.meta-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #273548;
  font-size: 20px;
  line-height: 1.25;
  font-weight: 700;
}

.meta-value small {
  margin-left: 3px;
  color: #647386;
  font-size: 12px;
  font-weight: 500;
}

.panel-head {
  min-height: 56px;
  padding: 0 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e8ecf2;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #253447;
  font-size: 16px;
}

.panel-title .el-icon {
  color: #0475FA;
  font-size: 18px;
}

.panel-head > span {
  color: #9aa5b4;
  font-size: 12px;
}

.rules-list {
  padding: 8px 22px 12px;
}

.rule-item {
  min-height: 54px;
  padding: 11px 4px;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #edf0f4;
}

.rule-item:last-child {
  border-bottom: 0;
}

.rule-number {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eaf4ff;
  color: #0475FA;
  font-size: 13px;
  font-weight: 700;
}

.rule-text {
  color: #526173;
  font-size: 14px;
  line-height: 1.65;
}

.empty-rules {
  padding: 36px 22px;
  text-align: center;
  color: #9aa5b4;
  font-size: 13px;
}

.confirm-panel {
  min-height: 72px;
  padding: 14px 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.agreement-checkbox {
  min-width: 0;
}

.agreement-text {
  color: #4f5d6d;
  font-size: 14px;
}

.action-buttons {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
}

.action-buttons :deep(.el-button) {
  min-width: 104px;
  height: 36px;
  padding: 0 18px;
  border-radius: 0 !important;
  font-size: 14px;
}

:deep(.el-checkbox__inner) {
  border-radius: 0 !important;
}

:deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: #0475FA;
  border-color: #0475FA;
}

@media (max-width: 1100px) {
  .exam-meta-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .overview-note {
    display: none;
  }
}
</style>
