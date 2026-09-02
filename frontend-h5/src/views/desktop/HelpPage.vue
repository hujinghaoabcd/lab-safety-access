<template>
  <div class="desktop-help-page">
    <div class="page-heading">
      <div>
        <h1>帮助中心</h1>
        <p>查看系统使用说明、常见问题与联系方式</p>
      </div>
    </div>

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
        <section class="quick-panel">
          <div class="panel-heading compact">
            <div>
              <h2>快捷入口</h2>
              <p>快速前往常用功能</p>
            </div>
          </div>

          <div class="quick-list">
            <button
              v-for="link in quickLinks"
              :key="link.path"
              class="quick-link"
              @click="navigateTo(link.path)"
            >
              <span class="quick-icon">
                <el-icon><component :is="link.icon" /></el-icon>
              </span>
              <span class="quick-copy">
                <strong>{{ link.title }}</strong>
                <small>{{ link.desc }}</small>
              </span>
              <span class="quick-arrow">›</span>
            </button>
          </div>
        </section>

        <section class="contact-panel">
          <div class="panel-heading compact">
            <div>
              <h2>联系我们</h2>
              <p>如遇系统问题，可通过以下方式咨询</p>
            </div>
          </div>

          <div class="contact-list">
            <div class="contact-item">
              <div class="contact-icon"><el-icon><Phone /></el-icon></div>
              <div>
                <div class="contact-label">咨询电话</div>
                <div class="contact-value">{{ contactInfo.phone }}</div>
              </div>
            </div>
            <div class="contact-item">
              <div class="contact-icon"><el-icon><Message /></el-icon></div>
              <div>
                <div class="contact-label">电子邮箱</div>
                <div class="contact-value">{{ contactInfo.email }}</div>
              </div>
            </div>
            <div class="contact-item">
              <div class="contact-icon"><el-icon><Location /></el-icon></div>
              <div>
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
import { useRouter } from 'vue-router'
import {
  Reading,
  EditPen,
  Medal,
  User,
  Phone,
  Message,
  Location
} from '@element-plus/icons-vue'
import { request } from '@/api/request'

const router = useRouter()

const activeNames = ref<string[]>([])

const helpItems = ref([
  {
    id: '1',
    title: '如何开始学习？',
    content: '进入“学习中心”后，可查看系统已发布的学习资料。根据资料类型阅读文档、查看图文或其他内容，完成考试前的知识准备。'
  },
  {
    id: '2',
    title: '如何参加考试？',
    content: '进入“考试中心”后，系统会显示当前账号可参加的考试。选择考试后请先阅读考试说明，再进入答题页面完成考试并提交。'
  },
  {
    id: '3',
    title: '考试未通过怎么办？',
    content: '如考试未通过，可在允许的考试次数范围内重新参加考试。建议先进入“错题本”复习答错题目，再重新作答。具体可考试次数以当前考试设置为准。'
  },
  {
    id: '4',
    title: '如何获取合格证书？',
    content: '考试成绩达到该场考试设置的合格分数后，系统会自动生成合格证书。可在“合格证书”页面预览并下载高清证书。'
  },
  {
    id: '5',
    title: '在哪里查看历史考试成绩？',
    content: '进入“考试记录”页面即可查看历史考试时间、成绩和通过状态，并可继续查看相应考试详情。'
  },
  {
    id: '6',
    title: '个人信息或头像如何修改？',
    content: '进入“个人中心”后，可修改允许编辑的个人资料、更换头像或修改登录密码。学号等由管理员维护的信息不可自行修改。'
  }
])

const quickLinks = [
  { icon: Reading, title: '学习中心', desc: '查看学习资料', path: '/learning' },
  { icon: EditPen, title: '考试中心', desc: '查看可参加考试', path: '/exam-center' },
  { icon: Medal, title: '合格证书', desc: '预览和下载证书', path: '/certificate' },
  { icon: User, title: '个人中心', desc: '管理个人资料', path: '/profile' }
]

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

<style scoped>
.desktop-help-page {
  padding: 0;
  color: #1f2937;
}

.page-heading {
  padding: 8px 0 20px;
  border-bottom: 1px solid #dfe4ea;
  margin-bottom: 20px;
}

.page-heading h1 {
  margin: 0 0 6px;
  font-size: 26px;
  font-weight: 700;
  color: #172033;
}

.page-heading p {
  margin: 0;
  font-size: 14px;
  color: #8a96a8;
}

.help-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
  align-items: start;
}

.faq-panel,
.quick-panel,
.contact-panel {
  background: #fff;
  border: 1px solid #e2e7ed;
}

.panel-heading {
  padding: 20px 22px 16px;
  border-bottom: 1px solid #e8ecf1;
}

.panel-heading.compact {
  padding: 18px 20px 14px;
}

.panel-heading h2 {
  margin: 0 0 5px;
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
  padding: 18px 22px 22px;
  background: #fafbfc;
  color: #5f6b7a;
  font-size: 14px;
  line-height: 1.9;
}

.side-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.quick-list {
  display: flex;
  flex-direction: column;
}

.quick-link {
  appearance: none;
  width: 100%;
  min-height: 72px;
  display: flex;
  align-items: center;
  padding: 13px 18px;
  background: #fff;
  border: none;
  border-bottom: 1px solid #edf0f4;
  text-align: left;
  cursor: pointer;
}

.quick-link:last-child {
  border-bottom: none;
}

.quick-link:hover {
  background: #f7fbff;
}

.quick-icon {
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #cfe3fa;
  color: #0475FA;
  background: #f3f8ff;
  font-size: 18px;
  margin-right: 13px;
}

.quick-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quick-copy strong {
  color: #253044;
  font-size: 14px;
}

.quick-copy small {
  color: #929cac;
  font-size: 12px;
}

.quick-arrow {
  color: #a9b2bf;
  font-size: 22px;
}

.contact-list {
  padding: 4px 18px 12px;
}

.contact-item {
  display: flex;
  gap: 12px;
  padding: 15px 0;
  border-bottom: 1px solid #edf0f4;
}

.contact-item:last-child {
  border-bottom: none;
}

.contact-icon {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0475FA;
  background: #f3f8ff;
  border: 1px solid #d8e8fa;
}

.contact-label {
  color: #97a1b0;
  font-size: 12px;
  margin-bottom: 5px;
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
