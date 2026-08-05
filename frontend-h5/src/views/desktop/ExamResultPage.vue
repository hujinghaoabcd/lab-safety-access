<template>
  <div class="desktop-exam-result">
    <el-card class="result-card" :class="{ 'fail-card': !isPassed }" shadow="hover">
      <div v-if="isPassed" class="success-content">
        <div class="success-icon-wrapper">
          <div class="success-icon">
            <el-icon><CircleCheck /></el-icon>
          </div>
          <div class="sparkle left">✨</div>
          <div class="sparkle right">✨</div>
        </div>
        <h2 class="result-title success">恭喜你，完成答题！</h2>
        <div class="result-stats">
          <div class="stat-item">
            <span class="stat-label">答对题目</span>
            <span class="stat-value success-value">{{ correct }}题</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">答错题目</span>
            <span class="stat-value error-value">{{ wrong }}题</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">得分</span>
            <span class="stat-value score-value">{{ score }}分</span>
          </div>
        </div>
      </div>

      <div v-else class="fail-content">
        <div class="fail-icon-wrapper">
          <div class="fail-icon">😔</div>
        </div>
        <h2 class="result-title fail">抱歉，只有{{ correct }}道题是对的！</h2>
        <div class="result-stats">
          <div class="stat-item">
            <span class="stat-label">答对题目</span>
            <span class="stat-value success-value">{{ correct }}题</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">答错题目</span>
            <span class="stat-value error-value">{{ wrong }}题</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">得分</span>
            <span class="stat-value score-value">{{ score }}分</span>
          </div>
        </div>
      </div>

      <div class="action-buttons">
        <el-button size="large" @click="handleContinue">
          <el-icon><RefreshRight /></el-icon>
          继续答题
        </el-button>
        <el-button type="primary" size="large" @click="handleRecords">
          <el-icon><List /></el-icon>
          查看记录
        </el-button>
        <el-button size="large" @click="handleQuit">
          <el-icon><HomeFilled /></el-icon>
          返回首页
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { CircleCheck, RefreshRight, List, HomeFilled } from '@element-plus/icons-vue'

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
  padding: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 70px);
}

.result-card {
  max-width: 800px;
  width: 100%;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15);
  background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
}

.result-card.fail-card {
  background: linear-gradient(135deg, #fff 0%, #fafafa 100%);
}

.success-content,
.fail-content {
  text-align: center;
  padding: 60px 40px 40px;
}

.success-icon-wrapper {
  position: relative;
  display: inline-block;
  margin-bottom: 32px;
}

.success-icon {
  width: 120px;
  height: 120px;
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(255, 193, 7, 0.4);
  position: relative;
  z-index: 1;
}

.success-icon .el-icon {
  font-size: 64px;
  color: #fff;
}

.sparkle {
  position: absolute;
  font-size: 32px;
  color: #FFD700;
  animation: sparkle 2s ease-in-out infinite;
}

.sparkle.left {
  top: -10px;
  left: -20px;
  animation-delay: 0s;
}

.sparkle.right {
  top: -10px;
  right: -20px;
  animation-delay: 1s;
}

@keyframes sparkle {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

.fail-icon-wrapper {
  margin-bottom: 32px;
}

.fail-icon {
  font-size: 120px;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
}

.result-title {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 32px;
  letter-spacing: 0.5px;
}

.result-title.success {
  background: linear-gradient(135deg, #0475FA 0%, #1a8cff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.result-title.fail {
  color: #606266;
}

.result-stats {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-bottom: 40px;
  padding: 32px;
  background: linear-gradient(135deg, #f0f7ff 0%, #e8f4ff 100%);
  border-radius: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  font-weight: 500;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
}

.success-value {
  color: #07c160;
}

.error-value {
  color: #f56c6c;
}

.score-value {
  background: linear-gradient(135deg, #FF9500 0%, #FFB800 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 36px;
}

.action-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
  padding: 32px 40px;
  border-top: 1px solid #ebeef5;
}

.action-buttons .el-button {
  flex: 1;
  border-radius: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  font-size: 16px;
  padding: 14px 24px;
}

.action-buttons .el-button--primary {
  box-shadow: 0 4px 12px rgba(4, 117, 250, 0.25);
}

.action-buttons .el-button--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(4, 117, 250, 0.35);
}
</style>

