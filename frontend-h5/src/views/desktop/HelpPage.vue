<template>
  <div class="desktop-help-page">
    <div class="help-layout">
      <section class="faq-panel">
        <div class="panel-heading">
          <div>
            <h2>常见问题</h2>
            <p>点击问题可展开查看具体说明</p>
          </div>
        </div>

        <el-collapse v-model="activeNames" class="faq-collapse">
          <el-collapse-item
            v-for="item in helpItems"
            :key="item.id"
            :title="item.title"
            :name="item.id"
          >
            <div class="faq-content">{{ item.content }}</div>
          </el-collapse-item>
        </el-collapse>
      </section>

      <aside class="side-column">
        <section class="contact-panel">
          <div class="panel-heading compact">
            <div>
              <h2>联系我们</h2>
              <p>如遇系统问题，可通过以下方式咨询</p>
            </div>
          </div>

          <div class="contact-list">
            <div class="contact-item">
              <el-icon class="contact-icon"><Phone /></el-icon>
              <div class="contact-copy">
                <div class="contact-label">咨询电话</div>
                <div class="contact-value">{{ contactInfo.phone }}</div>
              </div>
            </div>
            <div class="contact-item">
              <el-icon class="contact-icon"><Message /></el-icon>
              <div class="contact-copy">
                <div class="contact-label">电子邮箱</div>
                <div class="contact-value">{{ contactInfo.email }}</div>
              </div>
            </div>
            <div class="contact-item">
              <el-icon class="contact-icon"><OfficeBuilding /></el-icon>
              <div class="contact-copy">
                <div class="contact-label">工作地点</div>
                <div class="contact-value">{{ contactInfo.address }}</div>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Phone, Message, OfficeBuilding } from '@element-plus/icons-vue'
import { request } from '@/api/request'

const activeNames = ref<string[]>([])

// 与移动端帮助页保持完全一致，避免两端说明口径不同。
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

const defaultContact = {
  phone: '010-12345678',
  email: 'lab-safety@ucas.edu.cn',
  address: '中国科学院大学玉泉路校区'
}

const contactInfo = ref({ ...defaultContact })

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

<style scoped>
.desktop-help-page {
  padding: 0;
  color: #1f2937;
}

.help-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
  align-items: start;
}

.faq-panel,
.contact-panel {
  background: #fff;
  border: 1px solid #e2e7ed;
}

.panel-heading {
  padding: 18px 22px 14px;
  border-bottom: 1px solid #e8ecf1;
}

.panel-heading.compact {
  padding: 16px 18px 13px;
}

.panel-heading h2 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 700;
  color: #172033;
}

.panel-heading p {
  margin: 0;
  font-size: 12px;
  color: #98a2b2;
}

.faq-collapse {
  border-top: none;
  border-bottom: none;
}

:deep(.faq-collapse .el-collapse-item__header) {
  min-height: 58px;
  padding: 0 22px;
  border-bottom: 1px solid #edf0f4;
  color: #273244;
  font-size: 14px;
  font-weight: 600;
}

:deep(.faq-collapse .el-collapse-item__wrap) {
  border-bottom: 1px solid #edf0f4;
}

:deep(.faq-collapse .el-collapse-item__content) {
  padding: 0;
}

.faq-content {
  padding: 17px 22px 20px;
  background: #fafbfc;
  color: #5f6b7a;
  font-size: 14px;
  line-height: 1.85;
}

.side-column {
  display: flex;
  flex-direction: column;
}

.contact-list {
  padding: 4px 18px 10px;
}

.contact-item {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding: 14px 0;
  border-bottom: 1px solid #edf0f4;
}

.contact-item:last-child {
  border-bottom: none;
}

.contact-icon {
  margin-top: 2px;
  font-size: 17px;
  color: #0475FA;
}

.contact-copy {
  min-width: 0;
}

.contact-label {
  color: #7f8a99;
  font-size: 12px;
  margin-bottom: 4px;
}

.contact-value {
  color: #303b4d;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}

@media (max-width: 1150px) {
  .help-layout {
    grid-template-columns: minmax(0, 1fr) 320px;
  }
}
</style>
