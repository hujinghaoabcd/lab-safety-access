<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { getRecordsList } from '../api'

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
    console.log('[Records] getRecordsList response:', data)

    const list = data?.list || []
    const stats = data?.stats || {}

    records.value = list
    totalExams.value = stats.totalExams ?? list.length
    passedExams.value = stats.passedExams ?? 0
    highestScore.value = stats.highestScore ?? 0
  } catch (err: any) {
    console.error('[Records] getRecordsList error:', err)
    showToast(err?.message || '加载考试记录失败')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="records-page">
    <van-nav-bar class="blue-nav" title="考试记录" left-arrow @click-left="router.back()" />

    <div class="content">
      <div class="stats-card">
        <div class="stat-item">
          <span class="value">{{ totalExams }}</span>
          <span class="label">考试次数</span>
        </div>
        <div class="stat-item">
          <span class="value text-success">{{ passedExams }}</span>
          <span class="label">通过次数</span>
        </div>
        <div class="stat-item">
          <span class="value">{{ highestScore }}</span>
          <span class="label">最高分</span>
        </div>
      </div>

      <div class="record-list">
        <div
          v-for="record in records"
          :key="record.id"
          class="record-item"
          @click="viewDetail(record.id)"
        >
          <div class="record-header">
            <h3 class="record-title">{{ record.examTitle }}</h3>
          </div>
          <div class="ribbon" :class="record.passed ? 'success' : 'danger'">
            {{ record.passed ? '通过' : '未通过' }}
          </div>
          
          <div class="score-row">
            <span class="score" :class="{ failed: !record.passed }">
              {{ record.score }}
            </span>
            <span class="total-score">/ {{ record.totalScore }}分</span>
          </div>
          
          <div class="record-meta">
            <span>⏱️ 用时：{{ record.duration }}</span>
            <span>📅 {{ record.submitTime }}</span>
          </div>
        </div>
      </div>

      <van-empty v-if="records.length === 0" description="暂无考试记录" />
    </div>
  </div>
</template>

<style scoped>
.records-page {
  min-height: 100vh;
  background: #f7f8fa;
}

.content {
  padding: 4vw;
}

.stats-card {
  display: flex;
  background: #fff;
  border-radius: 0;
  padding: 5.333vw 0;
  margin-bottom: 4vw;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-item .value {
  font-size: 6.4vw;
  font-weight: 600;
  color: #323233;
}

.stat-item .label {
  font-size: 3.2vw;
  color: #969799;
  margin-top: 1.6vw;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 3.2vw;
}

.record-item {
  background: #fff;
  border-radius: 0;
  padding: 4vw;
  position: relative;
  overflow: hidden;
}

.record-header {
  margin-bottom: 3.2vw;
}

.record-title {
  font-size: 4vw;
  font-weight: 600;
  color: #323233;
}

.ribbon {
  position: absolute;
  top: 3vw;
  right: -8vw;
  width: 28vw;
  text-align: center;
  padding: 1vw 0;
  font-size: 3vw;
  font-weight: 500;
  color: #fff;
  transform: rotate(45deg);
}

.ribbon.success {
  background: linear-gradient(135deg, #07c160 0%, #05a14d 100%);
  box-shadow: 0 2px 4px rgba(7, 193, 96, 0.3);
}

.ribbon.danger {
  background: linear-gradient(135deg, #ee0a24 0%, #c80a1e 100%);
  box-shadow: 0 2px 4px rgba(238, 10, 36, 0.3);
}

.score-row {
  display: flex;
  align-items: baseline;
  margin-bottom: 3.2vw;
}

.score {
  font-size: 8vw;
  font-weight: 700;
  color: #07c160;
}

.score.failed {
  color: #ee0a24;
}

.total-score {
  font-size: 4vw;
  color: #969799;
  margin-left: 1.067vw;
}

.record-meta {
  display: flex;
  justify-content: space-between;
  font-size: 3.2vw;
  color: #969799;
}
</style>

