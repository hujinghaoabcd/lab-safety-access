<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

// 从路由参数获取结果
const score = Number(route.query.score) || 0
const total = Number(route.query.total) || 5
const correct = Number(route.query.correct) || 0
const wrong = Number(route.query.wrong) || 0
const passScore = Number(route.query.passScore) || 60

const isPassed = computed(() => score >= passScore)

// 模拟积分数据
const teamPoints = 5200
const personalPoints = 620

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

<template>
  <div class="exam-result-page" :class="{ 'fail-page': !isPassed }">
    <van-nav-bar 
      class="blue-nav" 
      title="答题汇总" 
      left-arrow 
      @click-left="router.back()"
    />

    <div class="result-container">
      <!-- 成功页面 -->
      <div v-if="isPassed" class="result-card">
        <div class="success-icon">
          <div class="check-circle">
            <van-icon name="success" size="10vw" color="#fff" />
          </div>
          <div class="sparkle left">✦</div>
          <div class="sparkle right">✦</div>
        </div>

        <h2 class="result-title success">恭喜你，完成答题！</h2>

        <div class="result-stats">
          <p>本次错误 <span class="highlight red">{{ wrong }}</span> 道题，答对 <span class="highlight blue">{{ correct }}</span> 道题</p>
          <p>得分 <span class="highlight gold">{{ score }}</span> 分</p>
        </div>



        <div class="action-buttons">
          <button class="btn primary" @click="handleContinue">继续答题</button>
          <button class="btn outline" @click="handleRecords">答题记录</button>
        </div>
      </div>

      <!-- 失败页面 -->
      <div v-else class="result-card fail-card">
        <div class="fail-icon">
          <div class="laptop-sad">
            <div class="laptop-screen">
              <div class="sad-face">
                <span class="eye">•</span>
                <span class="eye">•</span>
              </div>
              <div class="mouth">︵</div>
            </div>
            <div class="laptop-base"></div>
            <div class="steam left">~</div>
            <div class="steam right">~</div>
          </div>
        </div>

        <h5 class="result-title fail" style="font-size: 3.6vw;">抱歉，只有{{ correct }}道题是对的！</h5>

        <div class="action-buttons">
          <button class="btn primary" @click="handleContinue">继续答题</button>
          <button class="btn outline" @click="handleQuit">不答了</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exam-result-page {
  min-height: 100vh;
  background: #d9dde2;
  background-image: radial-gradient(circle, rgba(255,255,255,0.1) 2px, transparent 2px);
  background-size: 20px 20px;
}

.exam-result-page.fail-page {
  background: #d9dde2;
  background-image: none;
}


.result-container {
  padding: 8vw 6vw;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: calc(100vh - 46px);
}

.result-card {
  background: #fff;
  padding: 10vw 6vw 8vw;
  width: 100%;
  max-width: 85vw;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.result-card.fail-card {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

/* 成功图标 */
.success-icon {
  position: relative;
  display: inline-block;
  margin-bottom: 5vw;
}

.check-circle {
  width: 18vw;
  height: 18vw;
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 15px rgba(255, 193, 7, 0.4);
}

.sparkle {
  position: absolute;
  font-size: 4vw;
  color: #FFD700;
}

.sparkle.left {
  top: 0;
  left: -3vw;
}

.sparkle.right {
  top: 0;
  right: -3vw;
}

/* 失败图标 */
.fail-icon {
  margin-bottom: 6vw;
}

.laptop-sad {
  position: relative;
  display: inline-block;
}

.laptop-screen {
  width: 24vw;
  height: 16vw;
  background: #f5f5f5;
  border: 2px solid #ddd;
  border-radius: 2vw 2vw 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.sad-face {
  display: flex;
  gap: 3vw;
  margin-bottom: 1vw;
}

.eye {
  font-size: 4vw;
  color: #666;
}

.mouth {
  font-size: 4vw;
  color: #666;
}

.laptop-base {
  width: 28vw;
  height: 2vw;
  background: #ddd;
  border-radius: 0 0 1vw 1vw;
  margin-left: -2vw;
}

.steam {
  position: absolute;
  top: -4vw;
  font-size: 4vw;
  color: #ccc;
  animation: steam 1s infinite;
}

.steam.left {
  left: 2vw;
  animation-delay: 0.3s;
}

.steam.right {
  right: 2vw;
}

@keyframes steam {
  0%, 100% { transform: translateY(0); opacity: 0.5; }
  50% { transform: translateY(-2vw); opacity: 1; }
}

/* 标题 */
.result-title {
  font-size: 5vw;
  font-weight: 600;
  margin-bottom: 4vw;
}

.result-title.success {
  color: #333;
}

.result-title.fail {
  color: #333;
  margin-bottom: 8vw;
}

/* 统计 */
.result-stats {
  margin-bottom: 5vw;
}

.result-stats p {
  font-size: 3.5vw;
  color: #666;
  line-height: 2;
}

.highlight {
  font-weight: 600;
}

.highlight.red {
  color: #ee0a24;
}

.highlight.blue {
  color: #0475FA;
}

.highlight.gold {
  color: #FF9500;
}

/* 积分区域 */
.points-section {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4vw 0;
  margin-bottom: 6vw;
}

.points-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 6vw;
}

.points-label {
  font-size: 3vw;
  color: #999;
  margin-bottom: 1.5vw;
}

.points-value {
  font-size: 4.5vw;
  font-weight: 700;
  color: #333;
}

.points-divider {
  width: 1px;
  height: 10vw;
  background: #eee;
}

/* 按钮 */
.action-buttons {
  display: flex;
  gap: 4vw;
  justify-content: center;
}

.btn {
  padding: 3vw 8vw;
  font-size: 3.5vw;
  border-radius: 0;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.btn.primary {
  background: #0475FA;
  color: #fff;
  border: none;
}

.btn.outline {
  background: #fff;
  color: #0475FA;
  border: 1px solid #0475FA;
}

.btn:active {
  opacity: 0.8;
  transform: scale(0.98);
}
</style>

