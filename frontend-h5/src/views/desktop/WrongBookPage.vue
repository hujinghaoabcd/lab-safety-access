<template>
  <div class="desktop-wrongbook">
    <section class="wrongbook-panel">
      <div class="panel-toolbar">
        <div class="toolbar-title">
          <strong>错题列表</strong>
          <span>共 {{ counts.all }} 题</span>
        </div>
        <el-button
          type="danger"
          plain
          :disabled="!allQuestions.length"
          @click="clearAll"
        >
          清空错题本
        </el-button>
      </div>

      <div class="filter-row">
        <el-radio-group v-model="filterType" size="default">
          <el-radio-button label="all">全部 {{ counts.all }}</el-radio-button>
          <el-radio-button label="单选题">单选 {{ counts['单选题'] }}</el-radio-button>
          <el-radio-button label="多选题">多选 {{ counts['多选题'] }}</el-radio-button>
          <el-radio-button label="判断题">判断 {{ counts['判断题'] }}</el-radio-button>
        </el-radio-group>
      </div>

      <div v-if="loading" class="loading-state">加载中...</div>

      <div v-else-if="filtered.length === 0" class="empty-state">
        <div class="empty-icon">
          <el-icon><CircleCheck /></el-icon>
        </div>
        <div class="empty-title">暂无错题</div>
        <div class="empty-desc">当前筛选条件下没有需要复习的题目</div>
      </div>

      <div v-else class="question-list">
        <article v-for="q in pagedQuestions" :key="q.id" class="question-item">
          <div class="question-topline">
            <div class="question-meta">
              <el-tag :type="getTypeTag(q.type)" effect="plain">
                {{ q.type === '多选题' ? '多选' : q.type === '判断题' ? '判断' : '单选' }}
              </el-tag>
              <span class="wrong-count">错误 {{ q.wrongCount }} 次</span>
              <span class="last-time">
                <el-icon><Clock /></el-icon>
                {{ q.lastWrongTime || '时间未知' }}
              </span>
            </div>
            <el-button type="danger" link @click="removeOne(q.id)">移除</el-button>
          </div>

          <div class="question-content">{{ q.content }}</div>

          <div class="options-grid">
            <div v-for="(opt, idx) in q.options" :key="idx" class="option-item">
              <span class="option-label">{{ String.fromCharCode(65 + idx) }}.</span>
              <span class="option-text">{{ opt }}</span>
            </div>
          </div>

          <div class="answer-row">
            <div class="answer-main">
              <el-icon><CircleCheckFilled /></el-icon>
              <span class="answer-label">正确答案</span>
              <strong>{{ q.correctAnswer }}</strong>
            </div>
            <el-button type="primary" @click="retryQuestion(q)">重新练习</el-button>
          </div>
        </article>
      </div>

      <div v-if="filtered.length > 0" class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="filtered.length"
          layout="total, sizes, prev, pager, next, jumper"
          background
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { TagProps } from 'element-plus'
import { CircleCheck, CircleCheckFilled, Clock } from '@element-plus/icons-vue'
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
const currentPage = ref(1)
const pageSize = ref(10)

const filtered = computed(() => {
  if (filterType.value === 'all') return allQuestions.value
  return allQuestions.value.filter(q => q.type === filterType.value)
})

const pagedQuestions = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

const counts = computed(() => ({
  all: allQuestions.value.length,
  '单选题': allQuestions.value.filter(q => q.type === '单选题').length,
  '多选题': allQuestions.value.filter(q => q.type === '多选题').length,
  '判断题': allQuestions.value.filter(q => q.type === '判断题').length
}))

watch([filterType, pageSize], () => {
  currentPage.value = 1
})

watch(filtered, () => {
  const maxPage = Math.max(1, Math.ceil(filtered.value.length / pageSize.value))
  if (currentPage.value > maxPage) currentPage.value = maxPage
})

const getTypeTag = (type: string): TagProps['type'] => {
  const map: Record<string, TagProps['type']> = {
    '单选题': 'primary',
    '多选题': 'success',
    '判断题': 'warning'
  }
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
    await ElMessageBox.confirm('确认这道题已经掌握，移出错题本吗？', '确认移除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await removeWrongQuestion(id)
    ElMessage.success('已移出错题本')
    await loadWrongBook()
  } catch (err: any) {
    if (err !== 'cancel' && err !== 'close') ElMessage.error(err?.message || '移除失败')
  }
}

const clearAll = async () => {
  if (!allQuestions.value.length) return
  try {
    await ElMessageBox.confirm('确定要清空所有错题吗？此操作不可恢复。', '清空错题本', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await Promise.all(allQuestions.value.map(q => removeWrongQuestion(q.id)))
    ElMessage.success('已清空错题本')
    await loadWrongBook()
  } catch (err: any) {
    if (err !== 'cancel' && err !== 'close') ElMessage.error(err?.message || '清空失败')
  }
}

const retryQuestion = (_question?: WrongQuestion) => router.push('/exam-center')

onMounted(() => loadWrongBook())
</script>

<style scoped>
.desktop-wrongbook {
  padding: 0;
}

.wrongbook-panel {
  background: #fff;
  border: 1px solid #e5eaf2;
}

.panel-toolbar {
  min-height: 60px;
  padding: 0 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e5eaf2;
}

.toolbar-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.toolbar-title strong {
  font-size: 17px;
  color: #1f2d3d;
}

.toolbar-title span {
  font-size: 13px;
  color: #8a97a8;
}

.panel-toolbar :deep(.el-button) {
  height: 34px;
  border-radius: 0;
}

.filter-row {
  padding: 14px 22px;
  border-bottom: 1px solid #e5eaf2;
  background: #fafbfd;
}

.filter-row :deep(.el-radio-button__inner) {
  min-width: 86px;
  height: 34px;
  padding: 8px 16px;
  border-radius: 0 !important;
}

.loading-state {
  padding: 60px 0;
  text-align: center;
  color: #909399;
}

.empty-state {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
}

.empty-icon {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eef8f1;
  color: #35a854;
  margin-bottom: 14px;
}

.empty-icon .el-icon {
  font-size: 27px;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #425466;
  margin-bottom: 6px;
}

.empty-desc {
  font-size: 13px;
  color: #98a3b3;
}

.question-list {
  padding: 0 22px;
}

.question-item {
  padding: 20px 0;
  border-bottom: 1px solid #e8edf3;
}

.question-item:last-child {
  border-bottom: 0;
}

.question-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.question-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.question-meta :deep(.el-tag) {
  height: 26px;
  padding: 0 10px;
  border-radius: 0;
  font-size: 13px;
}

.wrong-count {
  font-size: 13px;
  color: #f05b67;
}

.last-time {
  display: flex;
  align-items: center;
  gap: 5px;
  padding-left: 12px;
  border-left: 1px solid #dfe5ec;
  font-size: 12px;
  color: #8d99aa;
}

.last-time .el-icon {
  font-size: 14px;
}

.question-content {
  font-size: 16px;
  font-weight: 500;
  color: #273444;
  line-height: 1.65;
  margin-bottom: 14px;
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-bottom: 14px;
}

.option-item {
  min-height: 42px;
  padding: 9px 12px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #f6f8fb;
  border: 1px solid #edf0f4;
  font-size: 14px;
  color: #59677a;
  line-height: 1.55;
}

.option-label {
  flex: 0 0 auto;
  font-weight: 600;
  color: #334155;
}

.answer-row {
  min-height: 44px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f2f9f3;
  border-left: 3px solid #49b267;
}

.answer-main {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #32964f;
  font-size: 14px;
}

.answer-main .el-icon {
  font-size: 17px;
}

.answer-label {
  color: #587064;
}

.answer-main strong {
  font-size: 15px;
  color: #278844;
}

.answer-row :deep(.el-button) {
  height: 32px;
  border-radius: 0;
  padding: 0 15px;
}

.pagination-row {
  min-height: 58px;
  padding: 12px 22px;
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

@media (max-width: 1100px) {
  .last-time {
    display: none;
  }
}
</style>
