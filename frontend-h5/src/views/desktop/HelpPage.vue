<template>
  <div class="desktop-help-page">
    <el-card class="page-header" shadow="never">
      <h2>帮助说明</h2>
      <p>常见问题与使用指南</p>
    </el-card>

    <!-- 快捷入口 -->
    <el-card class="quick-links-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <el-icon><Link /></el-icon>
          <span>快捷入口</span>
        </div>
      </template>
      <div class="links-grid">
        <div
          v-for="link in quickLinks"
          :key="link.path"
          class="link-item"
          :class="{ disabled: link.disabled }"
          @click="!link.disabled && navigateTo(link.path)"
        >
          <div class="link-icon">{{ link.icon }}</div>
          <div class="link-title">{{ link.title }}</div>
        </div>
      </div>
    </el-card>

    <!-- 常见问题 -->
    <el-card class="faq-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <el-icon><QuestionFilled /></el-icon>
          <span>常见问题</span>
        </div>
      </template>
      <el-collapse v-model="activeNames">
        <el-collapse-item
          v-for="item in helpItems"
          :key="item.id"
          :title="item.title"
          :name="item.id"
        >
          <div class="faq-content">{{ item.content }}</div>
        </el-collapse-item>
      </el-collapse>
    </el-card>

    <!-- 联系方式 -->
    <el-card class="contact-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <el-icon><Phone /></el-icon>
          <span>联系我们</span>
        </div>
      </template>
      <div class="contact-list">
        <div class="contact-item">
          <el-icon class="contact-icon"><Phone /></el-icon>
          <div class="contact-info">
            <div class="contact-label">咨询电话</div>
            <div class="contact-value">{{ contactInfo.phone }}</div>
          </div>
        </div>
        <div class="contact-item">
          <el-icon class="contact-icon"><Message /></el-icon>
          <div class="contact-info">
            <div class="contact-label">电子邮箱</div>
            <div class="contact-value">{{ contactInfo.email }}</div>
          </div>
        </div>
        <div class="contact-item">
          <el-icon class="contact-icon"><Location /></el-icon>
          <div class="contact-info">
            <div class="contact-label">工作地点</div>
            <div class="contact-value">{{ contactInfo.address }}</div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Link, QuestionFilled, Phone, Message, Location } from '@element-plus/icons-vue'
import { request } from '@/api/request'

const router = useRouter()

const activeNames = ref<string[]>([])

const helpItems = ref([
  {
    id: '1',
    title: '如何开始学习？',
    content: '点击首页"学习中心"，选择需要学习的内容。学习过程中请认真阅读内容，确保理解安全知识要点。'
  },
  {
    id: '2',
    title: '如何参加考试？',
    content: '完成相关课程学习后，进入"考试中心"选择对应的考试。考试前请仔细阅读考试须知，考试过程中请勿退出页面。'
  },
  {
    id: '3',
    title: '考试不及格怎么办？',
    content: '每门考试有3次考试机会。如未通过，可在"考试中心"重新参加考试。建议先复习"错题本"中的错题，巩固薄弱知识点后再次尝试。'
  },
  {
    id: '4',
    title: '如何获取合格证书？',
    content: '通过所有必修课程的考试后，系统将自动生成电子合格证书。您可在"合格证书"页面查看和下载证书。'
  },
  {
    id: '5',
    title: '证书有效期是多久？',
    content: '合格证书有效期为一年。证书到期前，系统会提醒您重新学习和考核，以确保您始终掌握最新的安全知识。'
  }
])

const quickLinks = ref([
  { icon: '📚', title: '开始学习', path: '/learning', disabled: true },
  { icon: '📝', title: '参加考试', path: '/exam-center' },
  { icon: '📜', title: '查看证书', path: '/certificate' },
  { icon: '👤', title: '个人中心', path: '/profile' }
])

const defaultContact = {
  phone: '010-12345678',
  email: 'lab-safety@ucas.edu.cn',
  address: '中国科学院大学玉泉路校区'
}

const contactInfo = ref({ ...defaultContact })

const navigateTo = (path: string) => {
  router.push(path)
}

onMounted(async () => {
  try {
    const res: any = await request.get('/admin/settings')
    const data = res?.data || res
    const contact = data?.contact || {}

    contactInfo.value = {
      phone: contact.phone || defaultContact.phone,
      email: contact.email || defaultContact.email,
      address: contact.address || defaultContact.address
    }
  } catch (error) {
    console.error('获取联系方式失败，使用默认值:', error)
    contactInfo.value = { ...defaultContact }
  }
})
</script>

<style scoped>
.desktop-help-page {
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

.quick-links-card,
.faq-card,
.contact-card {
  margin-bottom: 24px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 700;
  color: #303133;
  letter-spacing: 0.5px;
}

.card-header .el-icon {
  color: #0475FA;
  font-size: 22px;
}

.links-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.link-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px;
  background: linear-gradient(135deg, #f8f9fa 0%, #f0f2f5 100%);
  border-radius: 12px;
  border: 2px solid #ebeef5;
  cursor: pointer;
  transition: all 0.3s ease;
}

.link-item:hover:not(.disabled) {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border-color: #0475FA;
}

.link-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.link-icon {
  font-size: 48px;
}

.link-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.faq-content {
  font-size: 15px;
  color: #606266;
  line-height: 1.8;
  white-space: pre-line;
  padding: 8px 0;
}

.contact-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #f0f2f5 100%);
  border-radius: 12px;
  border: 2px solid #ebeef5;
  transition: all 0.3s ease;
}

.contact-item:hover {
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: #0475FA;
}

.contact-icon {
  font-size: 32px;
  color: #0475FA;
  flex-shrink: 0;
}

.contact-info {
  flex: 1;
}

.contact-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 6px;
  font-weight: 500;
}

.contact-value {
  font-size: 16px;
  color: #303133;
  font-weight: 600;
}
</style>

