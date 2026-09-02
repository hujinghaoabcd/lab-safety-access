<template>
  <div class="desktop-exam-center">
    <section class="exam-section">
      <div class="section-toolbar">
        <div class="section-heading">
          <strong>考试列表</strong>
          <span>查看当前可参加及已完成的考试</span>
        </div>

        <div class="summary-strip">
          <div class="summary-item">
            <span>全部</span>
            <strong>{{ totalCount }}</strong>
          </div>
          <div class="summary-item available">
            <span>可参加</span>
            <strong>{{ availableCount }}</strong>
          </div>
          <div class="summary-item passed">
            <span>已通过</span>
            <strong>{{ passedCount }}</strong>
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading-state">加载中...</div>

      <div v-else-if="!examList.length" class="empty-state">
        <div class="empty-icon"><el-icon><Document /></el-icon></div>
        <div class="empty-title">暂无考试</div>
        <div class="empty-desc">当前没有可显示的考试安排</div>
      </div>

      <template v-else>
        <div class="exam-list">
          <article v-for="item in pagedExams" :key="item.id" class="exam-card">
            <div class="exam-card-head">
              <div class="exam-title-wrap">
                <span class="exam-icon"><el-icon><EditPen /></el-icon></span>
                <div class="title-content">
                  <div class="exam-title">{{ item.name }}</div>
                  <div class="exam-category">{{ item.category || '实验室安全考试' }}</div>
                </div>
              </div>

              <el-tag :type="getStatusType(item.status)" effect="plain">
                {{ getStatusText(item.status) }}
              </el-tag>
            </div>

            <div class="exam-desc">
              {{ item.description || '请仔细阅读考试说明，认真完成本次安全考核。' }}
            </div>

            <div class="exam-meta">
              <div class="meta-item">
                <el-icon><Clock /></el-icon>
                <span>时长</span>
                <strong>{{ item.duration }} 分钟</strong>
              </div>
              <div class="meta-item">
                <el-icon><Document /></el-icon>
                <span>题量</span>
                <strong>{{ item.questionCount }} 题</strong>
              </div>
              <div class="meta-item">
                <el-icon><Trophy /></el-icon>
                <span>及格</span>
                <strong>{{ item.passScore }} 分</strong>
              </div>
            </div>

            <div class="exam-card-foot">
              <div class="attempt-info">
                <span v-if="item.maxAttempts">已考 {{ item.attempts || 0 }} / {{ item.maxAttempts }} 次</span>
                <span v-else>总分 {{ item.totalScore }} 分</span>
              </div>

              <el-button
                v-if="item.status === 'available'"
                type="primary"
                class="exam-action"
                @click="startExam(item)"
              >
                进入考试
              </el-button>
              <el-button
                v-else-if="item.status === 'passed'"
                type="success"
                class="exam-action"
                disabled
              >
                已通过
              </el-button>
              <el-button v-else class="exam-action" disabled>
                暂不可考
              </el-button>
            </div>
          </article>
        </div>

        <div v-if="examList.length > pageSize" class="pagination-row">
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="examList.length"
            layout="total, prev, pager, next"
            background
          />
        </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Clock, Document, EditPen, Trophy } from '@element-plus/icons-vue'
import { getExamList } from '@/api'

const router = useRouter()

interface ExamItem {
  id: number | string
  name: string
  category: string
  description: string
  duration: number
  questionCount: number
  passScore: number
  totalScore: number
  attempts: number
  maxAttempts: number
  status: 'available' | 'not_available' | 'passed'
}

const examList = ref<ExamItem[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = 9

const totalCount = computed(() => examList.value.length)
const availableCount = computed(() => examList.value.filter(item => item.status === 'available').length)
const passedCount = computed(() => examList.value.filter(item => item.status === 'passed').length)
const pagedExams = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return examList.value.slice(start, start + pageSize)
})

const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    available: '可参加',
    not_available: '暂不可考',
    passed: '已通过'
  }
  return map[status] || status
}

const getStatusType = (status: string) => {
  const map: Record<string, string> = {
    available: 'primary',
    not_available: 'info',
    passed: 'success'
  }
  return map[status] || 'info'
}

const startExam = (exam: ExamItem) => {
  if (exam.status !== 'available') return
  router.push({
    path: '/exam-info',
    query: { examId: String(exam.id) }
  })
}

onMounted(async () => {
  try {
    loading.value = true
    const resp: any = await getExamList()
    const data = resp?.data ?? resp

    const list: any[] = Array.isArray(data?.list)
      ? data.list
      : Array.isArray(data)
        ? data
        : []

    examList.value = list.map((item: any) => ({
      id: item.id,
      name: item.name,
      category: item.category || '',
      description: item.description || '',
      duration: Number(item.duration || 0),
      questionCount: Number(item.questionCount || 0),
      passScore: Number(item.passScore || 0),
      totalScore: Number(item.totalScore || 0),
      attempts: Number(item.attempts || 0),
      maxAttempts: Number(item.maxAttempts || 0),
      status: item.status
    }))
  } catch (err: any) {
    console.error('[ExamCenter] getExamList error:', err)
    ElMessage.error(err?.message || '加载考试列表失败')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.desktop-exam-center {
  padding: 0;
}

.exam-section {
  background: #fff;
  border: 1px solid #e3e8ef;
}

.section-toolbar {
  min-height: 64px;
  padding: 0 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid #e5eaf2;
}

.section-heading {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.section-heading strong {
  font-size: 17px;
  color: #1f2d3d;
}

.section-heading span {
  font-size: 12px;
  color: #98a3b3;
}

.summary-strip {
  display: flex;
  align-items: center;
  gap: 20px;
}

.summary-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  color: #8a97a8;
}

.summary-item strong {
  font-size: 17px;
  line-height: 1;
  color: #344255;
}

.summary-item.available strong {
  color: #0475FA;
}

.summary-item.passed strong {
  color: #37a958;
}

.exam-list {
  padding: 24px 24px 26px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  background: #f3f5f8;
}

.exam-card {
  min-width: 0;
  min-height: 330px;
  padding: 21px 22px 18px;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #dfe5ec;
  box-shadow: 0 4px 14px rgba(31, 45, 61, 0.08);
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.exam-card:hover {
  border-color: #9fc8fb;
  box-shadow: 0 6px 18px rgba(31, 45, 61, 0.11);
  transform: translateY(-1px);
}

.exam-card-head {
  min-height: 54px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.exam-title-wrap {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.exam-icon {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eaf4ff;
  color: #0475FA;
}

.exam-icon .el-icon {
  font-size: 20px;
}

.title-content {
  min-width: 0;
  padding-top: 1px;
}

.exam-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 17px;
  line-height: 23px;
  font-weight: 600;
  color: #243446;
}

.exam-category {
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #9aa5b4;
}

.exam-card-head :deep(.el-tag) {
  height: 27px;
  padding: 0 10px;
  border-radius: 0;
  font-size: 12px;
}

.exam-desc {
  min-height: 52px;
  margin: 17px 0 18px;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: #667386;
  font-size: 13px;
  line-height: 1.75;
}

.exam-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 13px 14px;
  background: #f5f7fa;
  box-shadow: inset 0 0 0 1px #eef1f4;
}

.meta-item {
  min-width: 0;
  display: grid;
  grid-template-columns: 19px 1fr;
  column-gap: 7px;
  row-gap: 2px;
  align-items: center;
}

.meta-item .el-icon {
  grid-row: 1 / span 2;
  font-size: 16px;
  color: #8fa0b2;
}

.meta-item span {
  font-size: 11px;
  color: #9aa5b4;
}

.meta-item strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #4f5d6d;
  font-size: 14px;
  font-weight: 500;
}

.exam-card-foot {
  min-height: 58px;
  margin-top: auto;
  padding-top: 14px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
}

.attempt-info {
  padding-bottom: 7px;
  color: #98a3b3;
  font-size: 12px;
}

.exam-action {
  min-width: 92px;
  height: 34px;
  padding: 0 17px;
  border-radius: 0 !important;
}

.pagination-row {
  min-height: 56px;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  border-top: 1px solid #e5eaf2;
}

.pagination-row :deep(.el-pagination button),
.pagination-row :deep(.el-pager li) {
  border-radius: 0 !important;
}

.loading-state {
  padding: 70px 0;
  text-align: center;
  color: #909399;
}

.empty-state {
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 11px;
  background: #edf5ff;
  color: #0475FA;
}

.empty-icon .el-icon {
  font-size: 23px;
}

.empty-title {
  margin-bottom: 5px;
  color: #425466;
  font-size: 16px;
  font-weight: 600;
}

.empty-desc {
  color: #98a3b3;
  font-size: 13px;
}

@media (max-width: 1250px) {
  .exam-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 950px) {
  .section-toolbar {
    align-items: flex-start;
    flex-direction: column;
    padding: 14px 16px;
  }

  .exam-list {
    grid-template-columns: 1fr;
    padding: 16px;
  }
}
</style>
