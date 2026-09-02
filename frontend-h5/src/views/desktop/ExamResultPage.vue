<template>
  <div class="desktop-exam-result">
    <section class="result-panel" :class="{ failed: !isPassed }">
      <div class="result-head">
        <span class="status-icon" :class="isPassed ? 'passed' : 'failed'">
          <el-icon v-if="isPassed"><CircleCheck /></el-icon>
          <span v-else class="status-face" aria-hidden="true">
            <i class="face-eye left"></i>
            <i class="face-eye right"></i>
            <i class="face-mouth"></i>
          </span>
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

        <div class="score-block" :class="isPassed ? 'passed' : 'failed'">
          <div class="score-line">
            <strong>{{ score }}</strong>
            <span>/ {{ total }}</span>
          </div>
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
          <span class="stat-label">得分</span>
          <strong class="stat-value score-value">{{ score }}<small>分</small></strong>
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
  CircleCheck,
  HomeFilled,
  List,
  RefreshRight
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
  padding: 42px 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.result-panel {
  width: min(640px, calc(100% - 48px));
  background: #fff;
  border: 1px solid #e2e7ee;
  box-shadow: 0 6px 20px rgba(31, 45, 61, 0.08);
}

.result-head {
  min-height: 306px;
  padding: 38px 42px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  border-bottom: 1px solid #e8ecf2;
}

.status-icon {
  width: 62px;
  height: 62px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  font-size: 56px;
}

.status-icon.passed {
  color: #25a85a;
}

.status-icon.failed {
  color: #e85b63;
}

.status-face {
  position: relative;
  width: 56px;
  height: 56px;
  display: block;
  box-sizing: border-box;
  border: 3px solid currentColor;
  border-radius: 50%;
}

.face-eye {
  position: absolute;
  top: 19px;
  width: 11px;
  height: 3px;
  background: currentColor;
  border-radius: 2px;
}

.face-eye.left {
  left: 11px;
  transform: rotate(13deg);
}

.face-eye.right {
  right: 11px;
  transform: rotate(-13deg);
}

.face-mouth {
  position: absolute;
  left: 50%;
  bottom: 10px;
  width: 22px;
  height: 11px;
  box-sizing: border-box;
  border: 3px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  transform: translateX(-50%);
}

.status-copy {
  max-width: 500px;
}

.status-label {
  margin-bottom: 8px;
  color: #7f8c9d;
  font-size: 13px;
  font-weight: 600;
}

.status-copy h1 {
  margin: 0;
  color: #1f2d3d;
  font-size: 27px;
  line-height: 1.35;
  font-weight: 700;
}

.status-copy p {
  margin: 11px 0 0;
  color: #7f8c9d;
  font-size: 14px;
  line-height: 1.65;
}

.score-block {
  margin-top: 22px;
  padding-top: 20px;
  min-width: 190px;
  text-align: center;
  border-top: 1px solid #edf0f4;
}

.score-line {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
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

.score-block span {
  color: #9aa5b4;
  font-size: 15px;
}

.score-block small {
  display: block;
  margin-top: 8px;
  color: #9aa5b4;
  font-size: 12px;
  font-weight: 400;
}

.result-stats {
  min-height: 140px;
  margin: 22px 30px 0;
  padding: 24px 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 38px;
  background: #eef6ff;
}

.stat-item {
  min-width: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  text-align: center;
}

.stat-label {
  color: #8d99a9;
  font-size: 13px;
  font-weight: 400;
}

.stat-value {
  font-size: 31px;
  line-height: 1.15;
  font-weight: 700;
}

.stat-value small {
  margin-left: 2px;
  color: inherit;
  font-size: 17px;
  font-weight: 600;
}

.success-value {
  color: #07c160;
}

.error-value {
  color: #ff6269;
}

.score-value {
  color: #f59a00;
  font-size: 35px;
}

.action-bar {
  padding: 24px 30px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.action-note {
  color: #8a97a8;
  font-size: 13px;
  text-align: center;
}

.action-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.action-buttons :deep(.el-button) {
  min-width: 116px;
  height: 38px;
  margin: 0;
  padding: 0 16px;
  border-radius: 0 !important;
  font-size: 14px;
  font-weight: 500;
}

.action-buttons :deep(.el-button--primary) {
  box-shadow: none;
}

@media (max-width: 720px) {
  .result-panel {
    width: calc(100% - 28px);
  }

  .result-head {
    min-height: 286px;
    padding: 32px 22px 28px;
  }

  .result-stats {
    margin-left: 18px;
    margin-right: 18px;
    gap: 18px;
    padding-left: 14px;
    padding-right: 14px;
  }

  .stat-item {
    min-width: 0;
    flex: 1;
  }

  .action-buttons {
    flex-wrap: wrap;
  }
}
</style>
