<template>
  <div class="desktop-profile">
    <div class="profile-layout">
      <section class="identity-panel">
        <div class="avatar-wrap" @click="handleAvatarClick">
          <el-avatar :size="104" :src="userInfo.avatar">
            {{ userInfo.name?.[0] || 'U' }}
          </el-avatar>
          <div class="avatar-edit">更换头像</div>
        </div>
        <input
          ref="avatarInputRef"
          type="file"
          accept="image/*"
          style="display: none"
          @change="handleAvatarChange"
        />

        <h2>{{ userInfo.name || '用户' }}</h2>
        <div class="student-id">{{ userInfo.studentId || '学号未设置' }}</div>
        <div class="department">{{ userInfo.department || '院系未设置' }}</div>
      </section>

      <section class="detail-panel">
        <div class="panel-toolbar">
          <div class="panel-title">基本信息</div>
          <div class="panel-actions">
            <el-button size="small" @click="openPasswordPopup">修改密码</el-button>
            <el-button type="primary" size="small" @click="openEdit">编辑资料</el-button>
          </div>
        </div>

        <div class="detail-table">
          <div class="detail-row">
            <div class="detail-label"><el-icon><User /></el-icon>姓名</div>
            <div class="detail-value">{{ userInfo.name || '未设置' }}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label"><el-icon><OfficeBuilding /></el-icon>院系</div>
            <div class="detail-value">{{ userInfo.department || '未设置' }}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label"><el-icon><Phone /></el-icon>手机号</div>
            <div class="detail-value">{{ userInfo.phone || '未设置' }}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label"><el-icon><Message /></el-icon>邮箱</div>
            <div class="detail-value">{{ userInfo.email || '未设置' }}</div>
          </div>
        </div>
      </section>
    </div>

    <div class="lower-layout">
      <section class="stats-panel">
        <div class="panel-title">学习与考试概况</div>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-icon primary"><el-icon><Document /></el-icon></div>
            <div class="stat-copy">
              <div class="stat-value">{{ stats.examCount }}</div>
              <div class="stat-name">考试次数</div>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-icon success"><el-icon><CircleCheck /></el-icon></div>
            <div class="stat-copy">
              <div class="stat-value">{{ stats.passCount }}</div>
              <div class="stat-name">通过次数</div>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-icon warning"><el-icon><Trophy /></el-icon></div>
            <div class="stat-copy">
              <div class="stat-value">{{ stats.certCount }}</div>
              <div class="stat-name">合格证书</div>
            </div>
          </div>
        </div>
      </section>

      <section class="quick-panel">
        <div class="panel-title">快捷功能</div>
        <div class="quick-grid">
          <button v-for="item in menuItems" :key="item.path" class="quick-item" @click="navigateTo(item.path)">
            <span class="quick-icon" :style="{ color: item.color }">
              <el-icon><component :is="getMenuIcon(item.icon)" /></el-icon>
            </span>
            <span class="quick-copy">
              <strong>{{ item.title }}</strong>
              <small>{{ item.desc }}</small>
            </span>
            <span class="quick-arrow">›</span>
          </button>
        </div>
      </section>
    </div>

    <el-dialog
      class="profile-dialog"
      v-model="showEditPopup"
      width="520px"
      :show-close="false"
      :close-on-click-modal="false"
    >
      <template #header="{ close }">
        <div class="dialog-titlebar">
          <div>
            <div class="dialog-title">编辑资料</div>
            <div class="dialog-subtitle">更新个人联系方式与基本信息</div>
          </div>
          <button class="dialog-close" type="button" aria-label="关闭" @click="close">×</button>
        </div>
      </template>

      <el-form class="profile-form" :model="editForm" label-width="72px">
        <el-form-item label="姓名">
          <el-input v-model="editForm.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="editForm.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="editForm.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="院系">
          <el-input v-model="editForm.department" placeholder="请输入院系" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditPopup = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      class="profile-dialog"
      v-model="showPasswordPopup"
      width="520px"
      :show-close="false"
      :close-on-click-modal="false"
    >
      <template #header="{ close }">
        <div class="dialog-titlebar">
          <div>
            <div class="dialog-title">修改密码</div>
            <div class="dialog-subtitle">请设置便于记忆且安全性较高的新密码</div>
          </div>
          <button class="dialog-close" type="button" aria-label="关闭" @click="close">×</button>
        </div>
      </template>

      <el-form class="profile-form" :model="passwordForm" label-width="72px">
        <el-form-item label="旧密码">
          <el-input v-model="passwordForm.oldPassword" type="password" placeholder="请输入旧密码" show-password />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="passwordForm.newPassword" type="password" placeholder="请输入新密码" show-password />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="passwordForm.confirmPassword" type="password" placeholder="请再次输入新密码" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPasswordPopup = false">取消</el-button>
        <el-button type="primary" @click="savePassword">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  User, OfficeBuilding, Phone, Message,
  Document, CircleCheck, Trophy, Medal, List, EditPen, TrendCharts
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { getUserProfile, updateUserProfile, getUserProfileStats, changePassword, uploadAvatar } from '@/api'

const router = useRouter()
const userStore = useUserStore()

const defaultAvatar = 'https://unpkg.com/@vant/assets@1.0.8/cat.jpeg'

const userInfo = reactive({
  name: '',
  studentId: '',
  department: '',
  phone: '',
  email: '',
  avatar: defaultAvatar
})

const editForm = reactive({ name: '', phone: '', email: '', department: '' })
const showEditPopup = ref(false)
const avatarInputRef = ref<HTMLInputElement | null>(null)

const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const showPasswordPopup = ref(false)

const stats = ref({ examCount: 0, passCount: 0, certCount: 0 })

const menuItems = [
  { icon: 'medal', title: '合格证书', desc: '查看和下载已获得证书', path: '/certificate', color: '#d99721' },
  { icon: 'list', title: '考试记录', desc: '查看历史考试成绩与详情', path: '/records', color: '#3a9b54' },
  { icon: 'edit', title: '错题本', desc: '复习历史错题与知识点', path: '/wrongbook', color: '#d65353' },
  { icon: 'trend', title: '排行榜', desc: '查看当前最高成绩排名', path: '/ranking', color: '#0475FA' }
]

const getMenuIcon = (icon: string) => {
  const map: Record<string, any> = { medal: Medal, list: List, edit: EditPen, trend: TrendCharts }
  return map[icon] || Document
}

const navigateTo = (path: string) => router.push(path)

const isLegacyDefaultAvatar = (raw: string) =>
  raw.includes('@vant/assets/cat.jpeg') || raw.includes('img.yzcdn.cn/vant/cat.jpeg')

const resolveAvatarUrl = (raw?: string | null) => {
  if (!raw) return defaultAvatar
  if (isLegacyDefaultAvatar(raw)) return defaultAvatar
  if (raw.startsWith('http')) return raw
  return '/api' + raw
}

const handleAvatarClick = () => avatarInputRef.value?.click()

const handleAvatarChange = async (event: Event) => {
  const file = (event.target as HTMLInputElement)?.files?.[0]
  if (!file) return

  try {
    const resp: any = await uploadAvatar(file)
    const data = resp?.data ?? resp
    if (data?.avatar) {
      userInfo.avatar = resolveAvatarUrl(data.avatar)
      if (userStore.userInfo) {
        userStore.setUserInfo({ ...userStore.userInfo, avatar: userInfo.avatar } as any)
      }
      ElMessage.success('头像更新成功')
    }
  } catch (err: any) {
    ElMessage.error(err?.message || '头像上传失败')
  } finally {
    if (avatarInputRef.value) avatarInputRef.value.value = ''
  }
}

const openEdit = () => {
  Object.assign(editForm, {
    name: userInfo.name,
    phone: userInfo.phone,
    email: userInfo.email,
    department: userInfo.department
  })
  showEditPopup.value = true
}

const saveEdit = async () => {
  if (!editForm.name.trim()) return ElMessage.warning('请输入姓名')
  try {
    const resp: any = await updateUserProfile(editForm)
    const updated = resp?.data ?? resp
    Object.assign(userInfo, {
      name: updated?.name || editForm.name,
      phone: updated?.phone || editForm.phone,
      email: updated?.email || editForm.email,
      department: updated?.department || editForm.department
    })
    if (userStore.userInfo) {
      userStore.setUserInfo({ ...userStore.userInfo, ...userInfo } as any)
    }
    showEditPopup.value = false
    ElMessage.success('保存成功')
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败')
  }
}

const openPasswordPopup = () => {
  Object.assign(passwordForm, { oldPassword: '', newPassword: '', confirmPassword: '' })
  showPasswordPopup.value = true
}

const savePassword = async () => {
  if (!passwordForm.oldPassword) return ElMessage.warning('请输入旧密码')
  if (!passwordForm.newPassword) return ElMessage.warning('请输入新密码')
  if (passwordForm.newPassword !== passwordForm.confirmPassword) return ElMessage.warning('两次密码不一致')
  try {
    await changePassword({ oldPassword: passwordForm.oldPassword, newPassword: passwordForm.newPassword })
    showPasswordPopup.value = false
    ElMessage.success('密码修改成功')
  } catch (err: any) {
    ElMessage.error(err?.message || '密码修改失败')
  }
}

onMounted(async () => {
  try {
    const resp: any = await getUserProfile()
    const data = resp?.data ?? resp
    Object.assign(userInfo, {
      name: data.name || '',
      studentId: data.studentId || '',
      department: data.department || '',
      phone: data.phone || '',
      email: data.email || '',
      avatar: resolveAvatarUrl(data.avatar)
    })

    if (userStore.userInfo) {
      userStore.setUserInfo({ ...userStore.userInfo, ...userInfo } as any)
    }

    const statsResp: any = await getUserProfileStats()
    const statsData = statsResp?.data ?? statsResp
    stats.value = {
      examCount: statsData?.examCount ?? 0,
      passCount: statsData?.passCount ?? 0,
      certCount: statsData?.certCount ?? 0
    }
  } catch (err: any) {
    ElMessage.error(err?.message || '加载用户信息失败')
  }
})
</script>

<style scoped>
.desktop-profile {
  padding: 0;
  color: #1f2937;
}

.profile-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.identity-panel,
.detail-panel,
.stats-panel,
.quick-panel {
  background: #fff;
  border: 1px solid #e2e7ed;
}

.identity-panel {
  min-height: 270px;
  padding: 26px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.avatar-wrap {
  position: relative;
  cursor: pointer;
  margin-bottom: 18px;
}

.avatar-edit {
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translate(-50%, 50%);
  padding: 3px 10px;
  background: #fff;
  border: 1px solid #d9e0e8;
  color: #64748b;
  font-size: 12px;
  white-space: nowrap;
}

.identity-panel h2 {
  margin: 4px 0 6px;
  font-size: 21px;
  color: #172033;
}

.student-id {
  font-size: 14px;
  color: #606b7a;
  margin-bottom: 8px;
}

.department {
  font-size: 13px;
  color: #98a2b2;
}

.detail-panel {
  padding: 18px 22px 22px;
}

.panel-toolbar {
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.panel-title {
  font-size: 16px;
  font-weight: 700;
  color: #172033;
}

.panel-actions {
  display: flex;
  gap: 8px;
}

.detail-table {
  border-top: 1px solid #e8ecf1;
  border-left: 1px solid #e8ecf1;
}

.detail-row {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  min-height: 48px;
}

.detail-label,
.detail-value {
  display: flex;
  align-items: center;
  border-right: 1px solid #e8ecf1;
  border-bottom: 1px solid #e8ecf1;
}

.detail-label {
  gap: 8px;
  padding: 0 16px;
  background: #f6f8fa;
  color: #687386;
  font-size: 13px;
}

.detail-label .el-icon {
  color: #8d98a8;
}

.detail-value {
  padding: 0 18px;
  color: #273244;
  font-size: 14px;
}

.lower-layout {
  display: grid;
  grid-template-columns: minmax(440px, 0.9fr) minmax(0, 1.35fr);
  gap: 16px;
}

.stats-panel,
.quick-panel {
  padding: 16px 18px 18px;
}

.stats-panel > .panel-title,
.quick-panel > .panel-title {
  margin-bottom: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid #e5eaf0;
  border-left: 1px solid #e5eaf0;
}

.stat-item {
  min-height: 92px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 14px;
  border-right: 1px solid #e5eaf0;
  border-bottom: 1px solid #e5eaf0;
}

.stat-icon {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid currentColor;
  font-size: 18px;
}

.stat-icon.primary { color: #0475FA; background: #f0f7ff; }
.stat-icon.success { color: #3a9b54; background: #f2faf4; }
.stat-icon.warning { color: #d99721; background: #fff8ea; }

.stat-copy {
  min-width: 0;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
  color: #172033;
  margin-bottom: 7px;
}

.stat-name {
  color: #687386;
  font-size: 13px;
  white-space: nowrap;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 1px solid #e5eaf0;
  border-left: 1px solid #e5eaf0;
}

.quick-item {
  appearance: none;
  border: none;
  border-right: 1px solid #e5eaf0;
  border-bottom: 1px solid #e5eaf0;
  background: #fff;
  min-height: 92px;
  padding: 12px 12px;
  display: flex;
  align-items: center;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;
}

.quick-item:hover {
  background: #f5f9ff;
}

.quick-icon {
  width: 30px;
  font-size: 21px;
  flex: 0 0 30px;
}

.quick-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.quick-copy strong {
  color: #253044;
  font-size: 14px;
  line-height: 1.3;
}

.quick-copy small {
  color: #929cac;
  font-size: 11px;
  line-height: 1.45;
}

.quick-arrow {
  margin-left: 5px;
  color: #a8b1bf;
  font-size: 18px;
  line-height: 1;
}

:deep(.profile-dialog.el-dialog) {
  padding: 0 !important;
  border-radius: 0 !important;
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(19, 39, 70, 0.24);
}

:deep(.profile-dialog .el-dialog__header) {
  margin: 0 !important;
  padding: 0 !important;
}

.dialog-titlebar {
  min-height: 58px;
  padding: 10px 16px 10px 18px;
  background: linear-gradient(90deg, #0b6fdb 0%, #1989fa 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.dialog-title {
  font-size: 17px;
  line-height: 1.3;
  font-weight: 700;
}

.dialog-subtitle {
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.76);
}

.dialog-close {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.88);
  font-size: 25px;
  line-height: 30px;
  cursor: pointer;
}

.dialog-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

:deep(.profile-dialog .el-dialog__body) {
  padding: 20px 24px 8px !important;
  background: #fff;
}

.profile-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.profile-form :deep(.el-form-item__label) {
  color: #596579;
  font-size: 13px;
}

.profile-form :deep(.el-input__wrapper) {
  min-height: 38px;
  border-radius: 0;
  box-shadow: 0 0 0 1px #d9e0e8 inset;
}

.profile-form :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #1989fa inset;
}

:deep(.profile-dialog .el-dialog__footer) {
  padding: 12px 24px !important;
  background: #f7f9fc;
  border-top: 1px solid #e5eaf0;
}

@media (max-width: 1250px) {
  .lower-layout {
    grid-template-columns: 1fr;
  }

  .quick-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1100px) {
  .profile-layout {
    grid-template-columns: 240px minmax(0, 1fr);
  }
}
</style>
