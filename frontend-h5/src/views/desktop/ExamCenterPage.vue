<template>
  <div class="desktop-exam-center">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <div class="header-icon">
          <el-icon><EditPen /></el-icon>
        </div>
        <div class="header-info">
          <h1>考试中心</h1>
          <p>在线考试与测评 · 完成安全考核</p>
        </div>
      </div>
      <div class="header-stats">
        <div class="stat-item">
          <span class="stat-num">{{ examList.length }}</span>
          <span class="stat-text">总考试</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-num success">{{ examList.filter(e => e.status === 'available').length }}</span>
          <span class="stat-text">可参加</span>
        </div>
      </div>
    </div>

    <!-- 考试列表 -->
    <div class="exam-section">
      <div class="section-title">考试列表</div>
      
      <el-empty v-if="!loading && !examList.length" description="暂无可参加的考试" />

      <div v-else class="exam-list">
        <div v-for="item in examList" :key="item.id" class="exam-card">
          <div class="exam-header">
            <div class="exam-title">{{ item.name }}</div>
            <el-tag :type="getStatusType(item.status)" size="small">
              {{ getStatusText(item.status) }}
            </el-tag>
          </div>
          
          <div class="exam-desc">{{ item.description || '请仔细阅读考试说明，认真作答每一道题目。' }}</div>
          
          <div class="exam-meta">
            <span class="meta-item">
              <el-icon><Clock /></el-icon>
              {{ item.duration }}分钟
            </span>
            <span class="meta-item">
              <el-icon><Document /></el-icon>
              {{ item.questionCount }}题
            </span>
            <span class="meta-item">
              <el-icon><Trophy /></el-icon>
              {{ item.passScore }}分及格
            </span>
          </div>

          <el-button
            v-if="item.status === 'available'"
            type="primary"
            class="exam-btn"
            @click="startExam(item)"
          >
            进入考试
          </el-button>
          <el-button
            v-else-if="item.status === 'passed'"
            type="success"
            class="exam-btn"
            disabled
          >
            已通过
          </el-button>
          <el-button
            v-else
            class="exam-btn"
            disabled
          >
            暂不可考
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { EditPen, Document, Clock, Trophy } from '@element-plus/icons-vue'
import { getExamList } from '@/api'

const router = useRouter()

interface ExamItem {
  id: number | string
  name: string
  description: string
  duration: number
  questionCount: number
  passScore: number
  totalScore: number
  status: 'available' | 'not_available' | 'passed'
}

const examList = ref<ExamItem[]>([])
const loading = ref(false)

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
      description: item.description || '实验室安全考试',
      duration: item.duration,
      questionCount: item.questionCount,
      passScore: item.passScore,
      totalScore: item.totalScore,
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

.header-stats {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px 20px;
  background: #f5f7fa;
  border-radius: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-num {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}

.stat-num.success {
  color: #67c23a;
}

.stat-text {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.stat-divider {
  width: 1px;
  height: 32px;
  background: #dcdfe6;
}

/* 考试列表 */
.exam-section {
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

.exam-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.exam-card {
  padding: 20px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.exam-card:hover {
  border-color: #0475FA;
  box-shadow: 0 4px 12px rgba(4, 117, 250, 0.1);
}

.exam-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.exam-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  flex: 1;
  margin-right: 12px;
}

.exam-desc {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  margin-bottom: 16px;
}

.exam-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #606266;
}

.meta-item .el-icon {
  font-size: 14px;
  color: #909399;
}

.exam-btn {
  width: 100%;
}
</style>
