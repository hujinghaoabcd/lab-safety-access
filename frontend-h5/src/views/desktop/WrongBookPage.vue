<template>
  <div class="desktop-wrongbook">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <div class="header-icon error">
          <el-icon><Close /></el-icon>
        </div>
        <div class="header-info">
          <h1>错题本</h1>
          <p>复习巩固错题，提升学习效果</p>
        </div>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-radio-group v-model="filterType" size="default">
        <el-radio-button label="all">全部 ({{ counts.all }})</el-radio-button>
        <el-radio-button label="单选题">单选 ({{ counts['单选题'] }})</el-radio-button>
        <el-radio-button label="多选题">多选 ({{ counts['多选题'] }})</el-radio-button>
        <el-radio-button label="判断题">判断 ({{ counts['判断题'] }})</el-radio-button>
      </el-radio-group>
      <el-button type="danger" plain size="small" :disabled="!allQuestions.length" @click="clearAll">
        清空错题本
      </el-button>
    </div>

    <!-- 题目列表 -->
    <div class="questions-section">
      <div class="section-title">错题列表</div>

      <el-empty v-if="!loading && filtered.length === 0" description="暂无错题" />

      <div v-else class="question-list">
        <div v-for="q in filtered" :key="q.id" class="question-card">
          <div class="question-header">
            <div class="question-meta">
              <el-tag :type="getTypeTag(q.type)" size="small">
                {{ q.type === '多选题' ? '多选' : q.type === '判断题' ? '判断' : '单选' }}
              </el-tag>
              <span class="wrong-count">错误 {{ q.wrongCount }} 次</span>
            </div>
            <el-button type="danger" link size="small" @click="removeOne(q.id)">移除</el-button>
          </div>

          <div class="question-content">{{ q.content }}</div>

          <div class="options-list">
            <div v-for="(opt, idx) in q.options" :key="idx" class="option-item">
              <span class="option-label">{{ String.fromCharCode(65 + idx) }}.</span>
              <span class="option-text">{{ opt }}</span>
            </div>
          </div>

          <el-alert :title="`正确答案：${q.correctAnswer}`" type="success" :closable="false" show-icon />

          <div v-if="q.analysis" class="analysis-box">
            <div class="analysis-title">
              <el-icon><InfoFilled /></el-icon>
              解析
            </div>
            <div class="analysis-text">{{ q.analysis }}</div>
          </div>

          <div class="question-footer">
            <span class="last-time">
              <el-icon><Clock /></el-icon>
              最后错误：{{ q.lastWrongTime || '未知' }}
            </span>
            <el-button type="primary" size="small" @click="retryQuestion(q)">重新练习</el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Close, InfoFilled, Clock } from '@element-plus/icons-vue'
import { getWrongBook, removeWrongQuestion } from '@/api/exam'

const router = useRouter()

interface WrongQuestion {
  id: number | string
  type: string
  content: string
  options: string[]
  correctAnswer: string
  analysis?: string
  wrongCount: number
  lastWrongTime: string | null
}

const allQuestions = ref<WrongQuestion[]>([])
const loading = ref(false)
const filterType = ref<'all' | '单选题' | '多选题' | '判断题'>('all')

const filtered = computed(() => {
  if (filterType.value === 'all') return allQuestions.value
  return allQuestions.value.filter(q => q.type === filterType.value)
})

const counts = computed(() => ({
  all: allQuestions.value.length,
  '单选题': allQuestions.value.filter(q => q.type === '单选题').length,
  '多选题': allQuestions.value.filter(q => q.type === '多选题').length,
  '判断题': allQuestions.value.filter(q => q.type === '判断题').length
}))

const getTypeTag = (type: string) => {
  const map: Record<string, string> = { '单选题': 'primary', '多选题': 'success', '判断题': 'warning' }
  return map[type] || 'info'
}

const loadWrongBook = async () => {
  try {
    loading.value = true
    const resp: any = await getWrongBook()
    allQuestions.value = resp?.data ?? resp ?? []
  } catch (err: any) {
    ElMessage.error(err?.message || '加载错题本失败')
  } finally {
    loading.value = false
  }
}

const removeOne = async (id: number | string) => {
  try {
    await ElMessageBox.confirm('确认这道题已经掌握，移出错题本吗？', '确认', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
    await removeWrongQuestion(id)
    ElMessage.success('已移出错题本')
    loadWrongBook()
  } catch (err: any) {
    if (err !== 'cancel') ElMessage.error(err?.message || '移除失败')
  }
}

const clearAll = async () => {
  if (!allQuestions.value.length) return
  try {
    await ElMessageBox.confirm('确定要清空所有错题吗？此操作不可恢复。', '清空错题本', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
    await Promise.all(allQuestions.value.map(q => removeWrongQuestion(q.id)))
    ElMessage.success('已清空错题本')
    loadWrongBook()
  } catch (err: any) {
    if (err !== 'cancel') ElMessage.error(err?.message || '清空失败')
  }
}

const retryQuestion = () => router.push('/exam-center')

onMounted(() => loadWrongBook())
</script>

<style scoped>
.desktop-wrongbook {
  padding: 0;
}

/* 页面头部 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  width: 48px;
  height: 48px;
  background: #0475FA;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-icon.error {
  background: #f56c6c;
}

.header-icon .el-icon {
  font-size: 24px;
  color: #fff;
}

.header-info h1 {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 4px 0;
}

.header-info p {
  font-size: 13px;
  color: #909399;
  margin: 0;
}

/* 筛选栏 */
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

/* 题目列表 */
.questions-section {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
}

.question-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.question-card {
  padding: 20px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.question-card:hover {
  border-color: #dcdfe6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.question-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wrong-count {
  font-size: 12px;
  color: #f56c6c;
}

.question-content {
  font-size: 15px;
  color: #303133;
  line-height: 1.7;
  margin-bottom: 16px;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.option-item {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 14px;
  color: #606266;
}

.option-label {
  font-weight: 600;
  color: #303133;
}

.analysis-box {
  margin-top: 16px;
  padding: 12px;
  background: #f0f9ff;
  border-radius: 4px;
  border-left: 3px solid #0475FA;
}

.analysis-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #0475FA;
  margin-bottom: 8px;
}

.analysis-text {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}

.question-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

.last-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #909399;
}

.last-time .el-icon {
  font-size: 14px;
}
</style>
