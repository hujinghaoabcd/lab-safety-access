<template>
  <div class="desktop-exam-result">
    <section class="result-panel" :class="{ failed: !isPassed }">
      <div class="result-head">
        <div class="status-main">
          <span class="status-icon" :class="isPassed ? 'passed' : 'failed'">
            <el-icon v-if="isPassed"><CircleCheckFilled /></el-icon>
            <el-icon v-else><WarningFilled /></el-icon>
          </span>
          <div class="status-copy">
            <div class="status-label">{{ isPassed ? '考试通过' : '考试未通过' }}</div>
            <h1>{{ isPassed ? '本次考试已完成' : '本次成绩未达到及格要求' }}</h1>
            <p>
              {{ isPassed
                ? `答对 ${correct} 题，成绩已记录。`
                : `答对 ${correct} 题，答错 ${wrong} 题，可返回考试中心重新参加考试。` }}
            </p>
          </div>
        </div>

        <div class="score-block" :class="isPassed ? 'passed' : 'failed'">
          <strong>{{ score }}</strong>
          <span>/ {{ total }}</span>
          <small>本次得分</small>
        </div>
      </div>

      <div class="result-stats">
        <div class="stat-item">
          <span class="stat-label">答对题目</span>
          <strong class="stat-value success-value">{{ correct }}<small>题</small></strong>
        </div>

        <div class="stat-item">
          <span class="stat-label">答错题目</span>
          <strong class="stat-value error-value">{{ wrong }}<small>题</small></strong>
        </div>

        <div class="stat-item">
          <span class="stat-label">及格分数</span>
          <strong class="stat-value score-value">{{ passScore }}<small>分</small></strong>
        </div>
      </div>

      <div class="action-bar">
        <div class="action-note">
          {{ isPassed ? '考试结果已保存，可前往考试记录查看详情。' : '本次考试结果已保存，可查看记录或重新参加考试。' }}
        </div>
        <div class="action-buttons">
          <el-button @click="handleContinue">
            <el-icon><RefreshRight /></el-icon>
            {{ isPassed ? '返回考试中心' : '重新考试' }}
          </el-button>
          <el-button type="primary" @click="handleRecords">
            <el-icon><List /></el-icon>
            查看记录
          </el-button>
          <el-button @click="handleQuit">
            <el-icon><HomeFilled /></el-icon>
            返回首页
          </el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  CircleCheckFilled,
  HomeFilled,
  List,
  RefreshRight,
  WarningFilled
} from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()

const score = Number(route.query.score) || 0
const total = Number(route.query.total) || 100
const correct = Number(route.query.correct) || 0
const wrong = Number(route.query.wrong) || 0
const passScore = Number(route.query.passScore) || 60

const isPassed = computed(() => score >= passScore)

const handleContinue = () => {
  router.push('/exam-center')
}

const handleRecords = () => {
  router.push('/records')
}

const handleQuit = () => {
  router.push('/dashboard')
}
</script>

<style scoped>
.desktop-exam-result {
  min-height: calc(100vh - 112px);
  padding: 36px 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.result-panel {
  width: min(1040px, 100%);
  background: #fff;
  border: 1px solid #e2e7ee;
  box-shadow: 0 5px 18px rgba(31, 45, 61, 0.075);
}

.result-head {
  min-height: 176px;
  padding: 34px 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 36px;
  border-bottom: 1px solid #e8ecf2;
}

.status-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 22px;
}

.status-icon {
  width: 62px;
  height: 62px;
  flex: 0 0 62px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 31px;
  border: 1px solid transparent;
}

.status-icon.passed {
  background: #eef8f2;
  border-color: #d9eee1;
  color: #25a85a;
}

.status-icon.failed {
  background: #fff5f2;
  border-color: #f4ded8;
  color: #e85b63;
}

.status-copy {
  min-width: 0;
}

.status-label {
  margin-bottom: 6px;
  color: #7f8c9d;
  font-size: 13px;
  font-weight: 600;
}

.status-copy h1 {
  margin: 0;
  color: #1f2d3d;
  font-size: 25px;
  line-height: 1.35;
  font-weight: 700;
}

.status-copy p {
  margin: 9px 0 0;
  color: #7f8c9d;
  font-size: 14px;
  line-height: 1.6;
}

.score-block {
  min-width: 176px;
  padding-left: 30px;
  text-align: right;
  border-left: 1px solid #e8ecf2;
}

.score-block strong {
  font-size: 46px;
  line-height: 1;
  font-weight: 750;
}

.score-block.passed strong {
  color: #25a85a;
}

.score-block.failed strong {
  color: #e85b63;
}

.score-block > span {
  margin-left: 5px;
  color: #9aa5b4;
  font-size: 15px;
}

.score-block small {
  display: block;
  margin-top: 9px;
  color: #9aa5b4;
  font-size: 12px;
  font-weight: 400;
}

.result-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 22px 38px;
  gap: 0;
  background: #fafbfd;
  border-bottom: 1px solid #e8ecf2;
}

.stat-item {
  min-height: 82px;
  padding: 10px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border-right: 1px solid #e5eaf0;
  text-align: center;
}

.stat-item:first-child {
  padding-left: 0;
}

.stat-item:last-child {
  padding-right: 0;
  border-right: 0;
}

.stat-label {
  color: #8d99a9;
  font-size: 13px;
}

.stat-value {
  font-size: 27px;
  line-height: 1.2;
  font-weight: 700;
}

.stat-value small {
  margin-left: 3px;
  color: #718095;
  font-size: 12px;
  font-weight: 500;
}

.success-value {
  color: #25a85a;
}

.error-value {
  color: #e85b63;
}

.score-value {
  color: #d89418;
}

.action-bar {
  min-height: 92px;
  padding: 20px 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
}

.action-note {
  color: #8a97a8;
  font-size: 13px;
}

.action-buttons {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
}

.action-buttons :deep(.el-button) {
  min-width: 118px;
  height: 38px;
  margin: 0;
  padding: 0 18px;
  border-radius: 0 !important;
  font-size: 14px;
  font-weight: 500;
}

.action-buttons :deep(.el-button--primary) {
  box-shadow: none;
}

@media (max-width: 1000px) {
  .result-head {
    align-items: flex-start;
  }

  .score-block {
    min-width: 140px;
  }

  .result-stats {
    padding-left: 24px;
    padding-right: 24px;
  }

  .action-bar {
    padding-left: 24px;
    padding-right: 24px;
  }
}
</style>
