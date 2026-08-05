<template>
  <div class="desktop-about-page">
    <el-card class="page-header" shadow="never">
      <h2>关于系统</h2>
      <p>实验室安全教育考试系统</p>
    </el-card>

    <el-card class="intro-card" shadow="hover">
      <div class="card-header">
        <div class="icon-wrapper intro">
          <el-icon><InfoFilled /></el-icon>
        </div>
        <div class="card-header-text">
          <h3 class="title">系统简介</h3>
        </div>
      </div>
      <p class="text">
        本系统用于实验室安全的在线学习和考试，统一管理课程、题库和成绩记录，
        帮助师生快速完成规定的实验室安全培训与准入考核。
      </p>
    </el-card>

    <el-card class="features-card" shadow="hover">
      <div class="card-header">
        <div class="icon-wrapper feature">
          <el-icon><Star /></el-icon>
        </div>
        <div class="card-header-text">
          <h3 class="title">功能特性</h3>
        </div>
      </div>
      <div class="feature-grid">
        <div class="feature-item">
          <div class="feature-icon learn">📚</div>
          <div class="feature-content">
            <div class="feature-title">在线学习</div>
            <div class="feature-desc">丰富的学习资料，支持PDF在线阅读</div>
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-icon exam">📝</div>
          <div class="feature-content">
            <div class="feature-title">在线考试</div>
            <div class="feature-desc">灵活的考试系统，实时答题与评分</div>
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-icon review">❌</div>
          <div class="feature-content">
            <div class="feature-title">错题复习</div>
            <div class="feature-desc">错题本功能，巩固薄弱知识点</div>
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-icon cert">📜</div>
          <div class="feature-content">
            <div class="feature-title">证书管理</div>
            <div class="feature-desc">电子证书生成与下载，方便保存</div>
          </div>
        </div>
      </div>
    </el-card>

    <el-card class="tips-card" shadow="hover">
      <div class="card-header">
        <div class="icon-wrapper tip">
          <el-icon><Star /></el-icon>
        </div>
        <div class="card-header-text">
          <h3 class="title">使用建议</h3>
        </div>
      </div>
      <ul class="tips-list">
        <li>考试过程中保持网络稳定，不要随意退出或刷新页面。</li>
        <li>可以多利用"错题本"和"考试记录"模块进行复习巩固。</li>
        <li>建议先完成学习中心的相关课程，再进行考试。</li>
      </ul>
    </el-card>

    <el-card class="help-card" shadow="hover">
      <div class="card-header">
        <div class="icon-wrapper help">
          <el-icon><QuestionFilled /></el-icon>
        </div>
        <div class="card-header-text">
          <h3 class="title">帮助与支持</h3>
        </div>
      </div>
      <p class="text">
        如果在使用过程中遇到操作疑问或系统问题，可以前往
        <el-link type="primary" @click="router.push('/help')">「帮助说明」</el-link>
        页面查看详细说明和联系方式。
      </p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { InfoFilled, Star, QuestionFilled } from '@element-plus/icons-vue'

const router = useRouter()
</script>

<style scoped>
.desktop-about-page {
  padding: 0;
}

.page-header {
  margin-bottom: 24px;
  border-radius: 16px;
  background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
  border: 1px solid rgba(0, 0, 0, 0.05);
  padding: 24px 32px;
}

.page-header h2 {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 8px 0;
  letter-spacing: 0.5px;
  background: linear-gradient(135deg, #0475FA 0%, #1a8cff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-header p {
  font-size: 15px;
  color: #606266;
  margin: 0;
  font-weight: 500;
}

.intro-card,
.features-card,
.tips-card,
.help-card {
  margin-bottom: 24px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.card-header {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f2f5;
}

.icon-wrapper {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 28px;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.icon-wrapper.intro {
  background: linear-gradient(135deg, #0475FA 0%, #4da3ff 100%);
}

.icon-wrapper.feature {
  background: linear-gradient(135deg, #07c160 0%, #34d19b 100%);
}

.icon-wrapper.tip {
  background: linear-gradient(135deg, #ff9f43 0%, #ff6f3c 100%);
}

.icon-wrapper.help {
  background: linear-gradient(135deg, #fa5151 0%, #ff6f61 100%);
}

.card-header-text {
  margin-left: 20px;
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
  margin: 0;
}

.text {
  font-size: 16px;
  color: #606266;
  line-height: 1.8;
  margin: 0;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #f0f2f5 100%);
  border-radius: 12px;
  border: 2px solid #ebeef5;
  transition: all 0.3s ease;
}

.feature-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border-color: #0475FA;
}

.feature-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  font-size: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.feature-icon.learn {
  background: linear-gradient(135deg, #0475FA 0%, #1a8cff 100%);
}

.feature-icon.exam {
  background: linear-gradient(135deg, #07c160 0%, #38d97f 100%);
}

.feature-icon.review {
  background: linear-gradient(135deg, #ff9f43 0%, #ffb896 100%);
}

.feature-icon.cert {
  background: linear-gradient(135deg, #fa5151 0%, #ff6f61 100%);
}

.feature-content {
  flex: 1;
}

.feature-title {
  font-size: 18px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 8px 0;
}

.feature-desc {
  font-size: 14px;
  color: #909399;
  line-height: 1.6;
  margin: 0;
}

.tips-list {
  padding-left: 24px;
  margin: 0;
}

.tips-list li {
  font-size: 16px;
  color: #606266;
  line-height: 1.8;
  margin-bottom: 12px;
}

.tips-list li:last-child {
  margin-bottom: 0;
}
</style>

