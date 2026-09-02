<template>
  <div class="desktop-profile">
    <div class="page-heading">
      <div>
        <h1>个人中心</h1>
        <p>查看个人信息、账户状态与学习考试数据</p>
      </div>
      <div class="heading-actions">
        <el-button @click="openPasswordPopup">修改密码</el-button>
        <el-button type="primary" @click="openEdit">编辑资料</el-button>
      </div>
    </div>

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
        <div class="panel-title">基本信息</div>
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

    <section class="stats-panel">
      <div class="panel-title">学习与考试概况</div>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-icon primary"><el-icon><Document /></el-icon></div>
          <div>
            <div class="stat-value">{{ stats.examCount }}</div>
            <div class="stat-name">考试次数</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon success"><el-icon><CircleCheck /></el-icon></div>
          <div>
            <div class="stat-value">{{ stats.passCount }}</div>
            <div class="stat-name">通过次数</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon warning"><el-icon><Trophy /></el-icon></div>
          <div>
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

    <el-dialog v-model="showEditPopup" title="编辑资料" width="480px">
      <el-form :model="editForm" label-width="80px">
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

    <el-dialog v-model="showPasswordPopup" title="修改密码" width="480px">
      <el-form :model="passwordForm" label-width="80px">
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
  Object.assign(editForm, { name: userInfo.name, phone: userInfo.phone, email: userInfo.email, department: userInfo.department })
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

.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
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

.heading-actions {
  display: flex;
  gap: 10px;
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
  padding: 30px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
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
  padding: 22px 24px 24px;
}

.panel-title {
  font-size: 16px;
  font-weight: 700;
  color: #172033;
  margin-bottom: 16px;
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

.stats-panel,
.quick-panel {
  padding: 20px 24px;
  margin-bottom: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid #e5eaf0;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 94px;
  padding: 16px 22px;
  border-right: 1px solid #e5eaf0;
}

.stat-item:last-child {
  border-right: none;
}

.stat-icon {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid currentColor;
  font-size: 20px;
}

.stat-icon.primary { color: #0475FA; background: #f0f7ff; }
.stat-icon.success { color: #3a9b54; background: #f2faf4; }
.stat-icon.warning { color: #d99721; background: #fff8ea; }

.stat-value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
  color: #172033;
  margin-bottom: 7px;
}

.stat-name {
  color: #8792a3;
  font-size: 13px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-top: 1px solid #e5eaf0;
  border-left: 1px solid #e5eaf0;
}

.quick-item {
  appearance: none;
  border: none;
  border-right: 1px solid #e5eaf0;
  border-bottom: 1px solid #e5eaf0;
  background: #fff;
  min-height: 82px;
  padding: 15px 18px;
  display: flex;
  align-items: center;
  text-align: left;
  cursor: pointer;
}

.quick-item:hover {
  background: #f7fbff;
}

.quick-icon {
  width: 36px;
  font-size: 22px;
  flex: 0 0 36px;
}

.quick-copy {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  flex: 1;
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
  margin-left: 12px;
  color: #a8b1bf;
  font-size: 22px;
  line-height: 1;
}

:deep(.el-dialog) {
  border-radius: 0 !important;
}

:deep(.el-dialog__header) {
  border-bottom: 1px solid #e5eaf0;
  margin-right: 0;
  padding: 18px 20px;
}

:deep(.el-dialog__footer) {
  border-top: 1px solid #e5eaf0;
  padding: 14px 20px;
}

@media (max-width: 1100px) {
  .profile-layout {
    grid-template-columns: 240px minmax(0, 1fr);
  }
}
</style>
