<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
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
    const res: any = await request.get('/user/contact')
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

<template>
  <div class="help-page">
    <van-nav-bar class="blue-nav" title="帮助说明" left-arrow @click-left="router.back()" />

    <div class="content">
      <!-- 快捷入口 -->
      <div class="quick-links">
        <div class="section-title">快捷入口</div>
        <div class="links-grid">
          <div
            v-for="link in quickLinks"
            :key="link.path"
            :class="['link-item', { disabled: link.disabled }]"
            @click="!link.disabled && navigateTo(link.path)"
          >
            <span class="link-icon">{{ link.icon }}</span>
            <span class="link-title">{{ link.title }}</span>
          </div>
        </div>
      </div>

      <!-- 常见问题 -->
      <div class="faq-section">
        <div class="section-title">常见问题</div>
        <van-collapse v-model="activeNames">
          <van-collapse-item
            v-for="item in helpItems"
            :key="item.id"
            :title="item.title"
            :name="item.id"
          >
            <div class="faq-content">{{ item.content }}</div>
          </van-collapse-item>
        </van-collapse>
      </div>

      <!-- 联系方式 -->
      <div class="contact-section">
        <div class="section-title">联系我们</div>
        <div class="contact-card">
          <div class="contact-item" style="align-items: center; display: flex;">
            <van-icon name="phone-o" size="5vw" color="#0475FA" />
            <div class="contact-info" style="display: flex; flex-direction: row; gap: 2vw; align-items: center; margin-left: 2vw;">
              <p class="label" style="font-size: 3.4vw;">咨询电话：{{ contactInfo.phone }}</p>
            </div>
          </div>
          <div class="contact-item">
            <van-icon name="envelop-o" size="5vw" color="#0475FA" />
            <div class="contact-info" style="display: flex; flex-direction: row; gap: 2vw; align-items: center; margin-left: 2vw;">
              <p class="label" style="font-size: 3.4vw;">电子邮箱：{{ contactInfo.email }}</p>
            </div>
          </div>
          <div class="contact-item">
            <van-icon name="shop-o" size="5vw" color="#0475FA" />
            <div class="contact-info" style="display: flex; flex-direction: row; gap: 2vw; align-items: center; margin-left: 2vw;">
              <p class="label" style="font-size: 3.4vw;">工作地点：{{ contactInfo.address }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.help-page {
  min-height: 100vh;
  background: #f7f8fa;
}

.content {
  padding: 4vw;
}

.section-title {
  font-size: 4vw;
  font-weight: 600;
  color: #323233;
  margin-bottom: 3.2vw;
}

/* 快捷入口 */
.quick-links {
  margin-bottom: 5.333vw;
}

.links-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3.2vw;
  background: #fff;
  padding: 4vw;
}

.link-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2vw;
  cursor: pointer;
}

.link-icon {
  font-size: 8vw;
}

.link-title {
  font-size: 3.2vw;
  color: #646566;
}

.link-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 常见问题 */
.faq-section {
  margin-bottom: 5.333vw;
}

.faq-content {
  font-size: 3.467vw;
  color: #646566;
  line-height: 1.8;
  white-space: pre-line;
}

/* 联系方式 */
.contact-card {
  background: #fff;
  padding: 4vw;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 4vw;
  padding: 3.2vw 0;
  border-bottom: 1px solid #f5f5f5;
}

.contact-item:last-child {
  border-bottom: none;
}

.contact-info .label {
  font-size: 3.2vw;
  color: #969799;
  margin-bottom: 1vw;
}

.contact-info .value {
  font-size: 3.733vw;
  color: #323233;
  font-weight: 500;
}
</style>
