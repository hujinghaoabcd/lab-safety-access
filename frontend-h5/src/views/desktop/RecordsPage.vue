<template>
  <div class="desktop-records">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <div class="header-icon">
          <el-icon><Document /></el-icon>
        </div>
        <div class="header-info">
          <h1>考试记录</h1>
          <p>查看历史考试记录和成绩</p>
        </div>
      </div>
    </div>

    <!-- 统计数据 -->
    <el-row :gutter="16" class="stats-row">
      <el-col :span="8">
        <div class="stat-card">
          <div class="stat-icon primary">
            <el-icon><Document /></el-icon>
          </div>
          <div class="stat-num">{{ totalExams }}</div>
          <div class="stat-label">考试次数</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="stat-card">
          <div class="stat-icon success">
            <el-icon><CircleCheck /></el-icon>
          </div>
          <div class="stat-num success">{{ passedExams }}</div>
          <div class="stat-label">通过次数</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="stat-card">
          <div class="stat-icon warning">
            <el-icon><Trophy /></el-icon>
          </div>
          <div class="stat-num warning">{{ highestScore }}</div>
          <div class="stat-label">最高分</div>
        </div>
      </el-col>
    </el-row>

    <!-- 记录列表 -->
    <div class="records-section">
      <div class="section-title">记录列表</div>

      <el-table :data="records" style="width: 100%" @row-click="viewDetail">
        <el-table-column prop="examTitle" label="考试名称" min-width="180">
          <template #default="{ row }">
            <span class="exam-name">{{ row.examTitle }}</span>
          </template>
        </el-table-column>
        <el-table-column label="成绩" width="120">
          <template #default="{ row }">
            <span class="score" :class="{ failed: !row.passed }">
              {{ row.score }}<span class="total">/{{ row.totalScore }}</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.passed ? 'success' : 'danger'" size="small">
              {{ row.passed ? '通过' : '未通过' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="duration" label="用时" width="100" />
        <el-table-column prop="submitTime" label="提交时间" width="160" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click.stop="viewDetail(row.id)">
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && records.length === 0" description="暂无考试记录" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Document, CircleCheck, Trophy } from '@element-plus/icons-vue'
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

const viewDetail = (id: string | number) => {
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
    passedExams.value = stats.passedExams ?? 0
    highestScore.value = stats.highestScore ?? 0
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

/* 统计数据 */
.stats-row {
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.stat-icon .el-icon {
  font-size: 20px;
  color: #fff;
}

.stat-icon.primary { background: #0475FA; }
.stat-icon.success { background: #67c23a; }
.stat-icon.warning { background: #e6a23c; }

.stat-num {
  font-size: 28px;
  font-weight: 700;
  color: #0475FA;
  line-height: 1.2;
}

.stat-num.success { color: #67c23a; }
.stat-num.warning { color: #e6a23c; }

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

/* 记录列表 */
.records-section {
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

.exam-name {
  font-weight: 500;
  color: #303133;
}

.score {
  font-size: 18px;
  font-weight: 600;
  color: #67c23a;
}

.score.failed {
  color: #f56c6c;
}

.score .total {
  font-size: 13px;
  font-weight: 400;
  color: #909399;
}

:deep(.el-table) {
  cursor: pointer;
}

:deep(.el-table__row:hover) {
  background: #f5f7fa;
}
</style>
