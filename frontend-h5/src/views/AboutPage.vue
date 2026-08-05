<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="about-page">
    <van-nav-bar
      class="blue-nav"
      title="关于系统"
      left-arrow
      @click-left="router.back()"
    />

    <div class="content">
      <!-- 系统简介 -->
      <section class="card card-intro">
        <div class="card-header">
          <div class="icon-circle intro">
            <van-icon name="info-o" size="3.2vw" />
          </div>
          <div class="card-header-text">
            <h2 class="title">系统简介</h2>
          </div>
        </div>
        <p class="text">
          本系统用于实验室安全的在线学习和考试，统一管理课程、题库和成绩记录，
          帮助师生快速完成规定的实验室安全培训与准入考核。
        </p>
      </section>

      <!-- 使用建议 -->
      <section class="card">
        <div class="card-header">
          <div class="icon-circle tip">
            <van-icon name="bulb-o" size="3.2vw" />
          </div>
          <div class="card-header-text">
            <h2 class="title">使用建议</h2>
          </div>
        </div>
        <ul class="list">
          <li>考试过程中保持网络稳定，不要随意退出或刷新页面。</li>
          <li>可以多利用“错题本”和“考试记录”模块进行复习巩固。</li>
        </ul>
      </section>

      <!-- 帮助与支持 -->
      <section class="card">
        <div class="card-header">
          <div class="icon-circle help">
            <van-icon name="service-o" size="3.2vw" />
          </div>
          <div class="card-header-text">
            <h2 class="title">帮助与支持</h2>
          </div>
        </div>
        <p class="text">
          如果在使用过程中遇到操作疑问或系统问题，可以前往
          <span class="link" @click="router.push('/help')">「帮助说明」</span>
          页面查看详细说明和联系方式。
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.about-page {
  min-height: 100vh;
  background: #f5f6fa;
}

.header-wrap {
  background: linear-gradient(135deg, #0475FA 0%, #5ba0f5 100%);
  padding-bottom: 6vw;
}

.hero {
  display: flex;
  justify-content: space-between;
  padding: 4vw;
  color: #fff;
}

.hero-left {
  flex: 1.4;
}

.hero-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.hero-sub {
  font-size: 2.8vw;
  letter-spacing: 0.3vw;
  opacity: 0.9;
  margin-bottom: 1.5vw;
}

.hero-title {
  font-size: 4.8vw;
  font-weight: 700;
  margin: 0 0 2vw 0;
}

.hero-desc {
  font-size: 3.2vw;
  line-height: 1.7;
  opacity: 0.9;
}

.hero-badge {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3vw;
  padding: 2.5vw 3vw;
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  max-width: 44vw;
}

.badge-main {
  display: inline-block;
  font-size: 3.4vw;
  font-weight: 600;
  margin-bottom: 1vw;
}

.badge-sub {
  display: block;
  font-size: 2.8vw;
  opacity: 0.85;
}

.content {
  padding: 3.5vw 4vw 5vw;
}

.card {
  background: #fff;
  padding: 4vw;
  margin-bottom: 4vw;
  border-radius: 0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}

.card-header {
  display: flex;
  align-items: center;
  margin-bottom: 3vw;
}

.icon-circle {
  width: 6vw;
  height: 6vw;
  border-radius: 1vw;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.icon-circle.intro {
  background: linear-gradient(135deg, #0475FA, #4da3ff);
}

.icon-circle.feature {
  background: linear-gradient(135deg, #07c160, #34d19b);
}

.icon-circle.tip {
  background: linear-gradient(135deg, #ff9f43, #ff6f3c);
}

.icon-circle.help {
  background: linear-gradient(135deg, #fa5151, #ff6f61);
}

.card-header-text {
  margin-left: 3vw;
}

.title {
  font-size: 4vw;
  font-weight: 600;
  color: #323233;
  margin: 0 0 1vw 0;
}

.subtitle {
  font-size: 3vw;
  color: #969799;
  margin: 0;
}

.text {
  font-size: 3.3vw;
  color: #646566;
  line-height: 1.8;
}

.link {
  color: #0475FA;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 3.5vw;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 2.5vw;
}

.feature-icon {
  width: 7vw;
  height: 7vw;
  border-radius: 2vw;
  font-size: 3.4vw;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.feature-icon.learn {
  background: #0475FA;
}

.feature-icon.exam {
  background: #07c160;
}

.feature-icon.review {
  background: #ff9f43;
}

.feature-icon.cert {
  background: #fa5151;
}

.feature-title {
  font-size: 3.4vw;
  color: #323233;
  margin: 0 0 1vw 0;
}

.feature-desc {
  font-size: 3.1vw;
  color: #969799;
  margin: 0;
  line-height: 1.7;
}

.list {
  padding-left: 4vw;
  margin: 0;
}

.list li {
  font-size: 3.3vw;
  color: #646566;
  line-height: 1.8;
  margin-bottom: 1.5vw;
}
</style>
