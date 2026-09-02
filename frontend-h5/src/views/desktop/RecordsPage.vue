<template>
  <div class="desktop-records">
    <section class="summary-strip">
      <div class="summary-item">
        <div class="summary-icon primary"><el-icon><Document /></el-icon></div>
        <div class="summary-copy">
          <span class="summary-label">考试次数</span>
          <strong>{{ totalExams }}</strong>
        </div>
      </div>
      <div class="summary-item">
        <div class="summary-icon success"><el-icon><CircleCheck /></el-icon></div>
        <div class="summary-copy">
          <span class="summary-label">通过次数</span>
          <strong class="success-text">{{ passedExams }}</strong>
        </div>
      </div>
      <div class="summary-item">
        <div class="summary-icon warning"><el-icon><Trophy /></el-icon></div>
        <div class="summary-copy">
          <span class="summary-label">最高分</span>
          <strong class="warning-text">{{ highestScore }}</strong>
        </div>
      </div>
    </section>

    <section class="records-panel">
      <div class="panel-toolbar">
        <div class="toolbar-title">
          <strong>考试记录</strong>
          <span>共 {{ records.length }} 条</span>
        </div>

        <el-radio-group v-model="statusFilter" size="default">
          <el-radio-button label="all">全部 {{ records.length }}</el-radio-button>
          <el-radio-button label="passed">通过 {{ passedCount }}</el-radio-button>
          <el-radio-button label="failed">未通过 {{ failedCount }}</el-radio-button>
        </el-radio-group>
      </div>

      <div v-if="loading" class="loading-state">加载中...</div>

      <div v-else-if="filteredRecords.length === 0" class="empty-state">
        <div class="empty-icon"><el-icon><Document /></el-icon></div>
        <div class="empty-title">暂无考试记录</div>
        <div class="empty-desc">
          {{ records.length ? '当前筛选条件下没有考试记录' : '完成考试后，成绩与提交时间会显示在这里' }}
        </div>
      </div>

      <template v-else>
        <el-table
          :data="pagedRecords"
          class="records-table"
          style="width: 100%"
          @row-click="viewDetail"
        >
          <el-table-column prop="examTitle" label="考试名称" min-width="260">
            <template #default="{ row }">
              <span class="exam-name">{{ row.examTitle }}</span>
            </template>
          </el-table-column>

          <el-table-column label="成绩" width="150">
            <template #default="{ row }">
              <span class="score" :class="{ failed: !row.passed }">
                {{ row.score }}<span class="total"> / {{ row.totalScore }}</span>
              </span>
            </template>
          </el-table-column>

          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="row.passed ? 'success' : 'danger'" effect="plain">
                {{ row.passed ? '通过' : '未通过' }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="duration" label="用时" width="130" />
          <el-table-column prop="submitTime" label="提交时间" width="190" />

          <el-table-column label="操作" width="120" fixed="right" align="center">
            <template #default="{ row }">
              <el-button type="primary" link @click.stop="viewDetail(row.id)">查看详情</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-row">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50]"
            :total="filteredRecords.length"
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
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CircleCheck, Document, Trophy } from '@element-plus/icons-vue'
import { getRecordsList } from '@/api'

const router = useRouter()

interface RecordItem {
  id: string | number
  examTitle: string
  score: number
  totalScore: number
  passed: boolean
  duration: string
  submitTime: string
}

const records = ref<RecordItem[]>([])
const totalExams = ref(0)
const passedExams = ref(0)
const highestScore = ref(0)
const loading = ref(false)
const statusFilter = ref<'all' | 'passed' | 'failed'>('all')
const currentPage = ref(1)
const pageSize = ref(10)

const passedCount = computed(() => records.value.filter(item => item.passed).length)
const failedCount = computed(() => records.value.filter(item => !item.passed).length)

const filteredRecords = computed(() => {
  if (statusFilter.value === 'passed') return records.value.filter(item => item.passed)
  if (statusFilter.value === 'failed') return records.value.filter(item => !item.passed)
  return records.value
})

const pagedRecords = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredRecords.value.slice(start, start + pageSize.value)
})

watch([statusFilter, pageSize], () => {
  currentPage.value = 1
})

watch(filteredRecords, () => {
  const maxPage = Math.max(1, Math.ceil(filteredRecords.value.length / pageSize.value))
  if (currentPage.value > maxPage) currentPage.value = maxPage
})

const viewDetail = (recordOrId: RecordItem | string | number) => {
  const id = typeof recordOrId === 'object' ? recordOrId.id : recordOrId
  router.push(`/record/${id}`)
}

onMounted(async () => {
  try {
    loading.value = true
    const resp: any = await getRecordsList()
    const data = resp?.data ?? resp
    const list = data?.list || []
    const stats = data?.stats || {}

    records.value = list
    totalExams.value = stats.totalExams ?? list.length
    passedExams.value = stats.passedExams ?? list.filter((item: RecordItem) => item.passed).length
    highestScore.value = stats.highestScore ?? Math.max(0, ...list.map((item: RecordItem) => Number(item.score) || 0))
  } catch (err: any) {
    ElMessage.error(err?.message || '加载考试记录失败')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.desktop-records {
  padding: 0;
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  background: #fff;
  border: 1px solid #e5eaf2;
  margin-bottom: 12px;
}

.summary-item {
  min-height: 62px;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-right: 1px solid #e5eaf2;
}

.summary-item:last-child {
  border-right: 0;
}

.summary-icon {
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.summary-icon .el-icon {
  font-size: 18px;
}

.summary-icon.primary { background: #0475fa; }
.summary-icon.success { background: #39ad59; }
.summary-icon.warning { background: #e8a12d; }

.summary-copy {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.summary-label {
  font-size: 13px;
  color: #8793a5;
  white-space: nowrap;
}

.summary-copy strong {
  font-size: 23px;
  line-height: 1;
  color: #1f2d3d;
}

.success-text { color: #2f9e4d !important; }
.warning-text { color: #d9901f !important; }

.records-panel {
  background: #fff;
  border: 1px solid #e5eaf2;
}

.panel-toolbar {
  min-height: 52px;
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
  min-width: 72px;
  height: 30px;
  padding: 6px 11px;
  line-height: 16px;
  border-radius: 0 !important;
  font-size: 13px;
}

.records-table :deep(.el-table__header th) {
  height: 46px;
  background: #f6f8fb;
  color: #59677a;
  font-size: 13px;
  font-weight: 600;
}

.records-table :deep(.el-table__row td) {
  height: 58px;
  color: #59677a;
}

.records-table :deep(.el-table__row) {
  cursor: pointer;
}

.records-table :deep(.el-table__row:hover > td) {
  background: #f7faff !important;
}

.exam-name {
  font-size: 14px;
  font-weight: 600;
  color: #273444;
}

.score {
  font-size: 18px;
  font-weight: 700;
  color: #2fa34e;
}

.score.failed {
  color: #e95b67;
}

.score .total {
  font-size: 12px;
  font-weight: 400;
  color: #98a3b3;
}

.records-table :deep(.el-tag) {
  min-width: 58px;
  height: 28px;
  padding: 0 10px;
  justify-content: center;
  border-radius: 0;
  font-size: 13px;
}

.records-table :deep(.el-button) {
  font-size: 13px;
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
}

.empty-icon {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
  background: #eef5ff;
  color: #0475fa;
}

.empty-icon .el-icon {
  font-size: 26px;
}

.empty-title {
  margin-bottom: 6px;
  font-size: 16px;
  font-weight: 600;
  color: #425466;
}

.empty-desc {
  font-size: 13px;
  color: #98a3b3;
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

@media (max-width: 1100px) {
  .summary-item {
    padding: 9px 14px;
  }

  .summary-copy {
    gap: 7px;
  }

  .panel-toolbar {
    align-items: flex-start;
    flex-direction: column;
    padding: 14px 18px;
  }
}
</style>
