<template>
  <div class="desktop-exam-info">
    <el-card class="page-header" shadow="never">
      <h2>考试说明</h2>
      <p>请仔细阅读考试须知后开始答题</p>
    </el-card>

    <el-card class="info-card" shadow="hover">
      <div class="exam-title-wrapper">
        <h3 class="exam-title">{{ examInfo.name || '实验室安全考试' }}</h3>
      </div>

      <div class="exam-meta-grid">
        <div class="meta-item">
          <div class="meta-icon-wrapper" style="background: linear-gradient(135deg, #FF6B6B 0%, #FF8E8E 100%);">
            <el-icon><Clock /></el-icon>
          </div>
          <div class="meta-content">
            <div class="meta-label">考试时长</div>
            <div class="meta-value">{{ examInfo.duration }}分钟</div>
          </div>
        </div>

        <div class="meta-item">
          <div class="meta-icon-wrapper" style="background: linear-gradient(135deg, #4ECDC4 0%, #6EDDD6 100%);">
            <el-icon><Document /></el-icon>
          </div>
          <div class="meta-content">
            <div class="meta-label">题目数量</div>
            <div class="meta-value">{{ examInfo.questionCount }}题</div>
          </div>
        </div>

        <div class="meta-item">
          <div class="meta-icon-wrapper" style="background: linear-gradient(135deg, #FFE66D 0%, #FFF89C 100%);">
            <el-icon><Trophy /></el-icon>
          </div>
          <div class="meta-content">
            <div class="meta-label">及格分数</div>
            <div class="meta-value">{{ examInfo.passScore }}分</div>
          </div>
        </div>

        <div class="meta-item">
          <div class="meta-icon-wrapper" style="background: linear-gradient(135deg, #95E1D3 0%, #B5F0E3 100%);">
            <el-icon><Star /></el-icon>
          </div>
          <div class="meta-content">
            <div class="meta-label">满分</div>
            <div class="meta-value">{{ examInfo.totalScore }}分</div>
          </div>
        </div>
      </div>
    </el-card>

    <el-card class="rules-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <el-icon><InfoFilled /></el-icon>
          <span>考试须知</span>
        </div>
      </template>

      <div v-if="examInfo.rules.length > 0" class="rules-list">
        <div
          v-for="(rule, index) in examInfo.rules"
          :key="index"
          class="rule-item"
        >
          <div class="rule-number">{{ index + 1 }}</div>
          <div class="rule-text">{{ rule }}</div>
        </div>
      </div>
      <el-empty v-else description="暂无考试须知" />
    </el-card>

    <el-card class="agreement-card" shadow="hover">
      <el-checkbox v-model="agreed" size="large">
        <span class="agreement-text">我已阅读并理解以上考试须知，同意开始考试</span>
      </el-checkbox>
    </el-card>

    <div class="action-buttons">
      <el-button size="large" @click="router.back()">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <el-button
        type="primary"
        size="large"
        :disabled="!agreed"
        @click="handleStartExam"
      >
        <el-icon><Right /></el-icon>
        开始考试
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Clock, Document, Trophy, Star, InfoFilled, ArrowLeft, Right } from '@element-plus/icons-vue'
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
    console.log('[ExamInfo] getExamDetail response:', data)

    examInfo.value.id = String(data.id)
    examInfo.value.name = data.name || '实验室安全考试'
    examInfo.value.description = data.description || ''
    examInfo.value.duration = data.duration || 0
    examInfo.value.questionCount = data.questionCount || 0
    examInfo.value.passScore = data.passScore || 0
    examInfo.value.totalScore = data.totalScore || 100

    examInfo.value.rules = (examInfo.value.description || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0)
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

.info-card {
  margin-bottom: 24px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.exam-title-wrapper {
  text-align: center;
  padding: 32px 0 24px;
  background: linear-gradient(135deg, #f0f7ff 0%, #e8f4ff 100%);
  margin: -20px -20px 24px -20px;
}

.exam-title {
  font-size: 26px;
  font-weight: 700;
  color: #303133;
  margin: 0;
  letter-spacing: 0.5px;
}

.exam-meta-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  padding: 0 8px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #fafbfc 0%, #f5f7fa 100%);
  border-radius: 12px;
  border: 2px solid #ebeef5;
  transition: all 0.3s ease;
}

.meta-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border-color: #0475FA;
}

.meta-icon-wrapper {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.meta-content {
  flex: 1;
}

.meta-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 6px;
  font-weight: 500;
}

.meta-value {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}

.rules-card {
  margin-bottom: 24px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 700;
  color: #303133;
  letter-spacing: 0.5px;
}

.card-header .el-icon {
  color: #0475FA;
  font-size: 22px;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rule-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #f0f7ff 0%, #e8f4ff 100%);
  border-radius: 12px;
  border-left: 4px solid #0475FA;
  transition: all 0.3s ease;
}

.rule-item:hover {
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(4, 117, 250, 0.15);
}

.rule-number {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #0475FA 0%, #1a8cff 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(4, 117, 250, 0.3);
}

.rule-text {
  flex: 1;
  font-size: 15px;
  color: #606266;
  line-height: 1.7;
  padding-top: 4px;
}

.agreement-card {
  margin-bottom: 24px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  padding: 24px;
}

.agreement-text {
  font-size: 16px;
  color: #606266;
  font-weight: 500;
}

.action-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
  padding: 0 0 24px;
}

.action-buttons .el-button {
  min-width: 160px;
  border-radius: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  font-size: 16px;
  padding: 14px 32px;
}

.action-buttons .el-button--primary {
  box-shadow: 0 4px 12px rgba(4, 117, 250, 0.25);
  transition: all 0.3s ease;
}

.action-buttons .el-button--primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(4, 117, 250, 0.35);
}

:deep(.el-checkbox) {
  font-size: 16px;
}

:deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: #0475FA;
  border-color: #0475FA;
}
</style>

