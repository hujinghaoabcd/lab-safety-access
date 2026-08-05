<template>
  <div class="desktop-profile">
    <!-- 用户信息卡片 -->
    <div class="profile-card">
      <div class="avatar-section">
        <el-avatar :size="80" :src="userInfo.avatar" @click="handleAvatarClick">
          {{ userInfo.name?.[0] || 'U' }}
        </el-avatar>
        <input
          ref="avatarInputRef"
          type="file"
          accept="image/*"
          style="display: none"
          @change="handleAvatarChange"
        />
        <span class="avatar-tip">点击更换</span>
      </div>
      
      <div class="info-section">
        <h2 class="user-name">{{ userInfo.name || '用户' }}</h2>
        <div class="info-grid">
          <div class="info-item">
            <el-icon><User /></el-icon>
            <span>{{ userInfo.studentId || '未设置' }}</span>
          </div>
          <div class="info-item">
            <el-icon><OfficeBuilding /></el-icon>
            <span>{{ userInfo.department || '未设置' }}</span>
          </div>
          <div class="info-item">
            <el-icon><Phone /></el-icon>
            <span>{{ userInfo.phone || '未设置' }}</span>
          </div>
          <div class="info-item">
            <el-icon><Message /></el-icon>
            <span>{{ userInfo.email || '未设置' }}</span>
          </div>
        </div>
        <div class="action-btns">
          <el-button type="primary" size="small" @click="openEdit">编辑资料</el-button>
          <el-button size="small" @click="openPasswordPopup">修改密码</el-button>
        </div>
      </div>
    </div>

    <!-- 统计数据 -->
    <el-row :gutter="16" class="stats-row">
      <el-col :span="8">
        <div class="stat-card">
          <div class="stat-icon primary">
            <el-icon><Document /></el-icon>
          </div>
          <div class="stat-num">{{ stats.examCount }}</div>
          <div class="stat-label">考试次数</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="stat-card">
          <div class="stat-icon success">
            <el-icon><CircleCheck /></el-icon>
          </div>
          <div class="stat-num success">{{ stats.passCount }}</div>
          <div class="stat-label">通过次数</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="stat-card">
          <div class="stat-icon warning">
            <el-icon><Trophy /></el-icon>
          </div>
          <div class="stat-num warning">{{ stats.certCount }}</div>
          <div class="stat-label">合格证书</div>
        </div>
      </el-col>
    </el-row>

    <!-- 快捷功能 -->
    <div class="quick-section">
      <div class="section-title">快捷功能</div>
      <el-row :gutter="16">
        <el-col v-for="item in menuItems" :key="item.path" :span="6">
          <div class="quick-item" @click="navigateTo(item.path)">
            <div class="quick-icon" :style="{ background: item.color }">
              <el-icon><component :is="getMenuIcon(item.icon)" /></el-icon>
            </div>
            <span class="quick-title">{{ item.title }}</span>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 编辑资料对话框 -->
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

    <!-- 修改密码对话框 -->
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

const userInfo = reactive({
  name: '',
  studentId: '',
  department: '',
  phone: '',
  email: '',
  avatar: 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'
})
const defaultAvatar = userInfo.avatar

const editForm = reactive({ name: '', phone: '', email: '', department: '' })
const showEditPopup = ref(false)
const avatarInputRef = ref<HTMLInputElement | null>(null)

const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const showPasswordPopup = ref(false)

const stats = ref({ examCount: 0, passCount: 0, certCount: 0 })

const menuItems = [
  { icon: 'medal', title: '我的证书', path: '/certificate', color: '#e6a23c' },
  { icon: 'list', title: '考试记录', path: '/records', color: '#67c23a' },
  { icon: 'edit', title: '错题本', path: '/wrongbook', color: '#f56c6c' },
  { icon: 'trend', title: '排行榜', path: '/ranking', color: '#0475FA' }
]

const getMenuIcon = (icon: string) => {
  const map: Record<string, any> = { medal: Medal, list: List, edit: EditPen, trend: TrendCharts }
  return map[icon] || Document
}

const navigateTo = (path: string) => router.push(path)

const resolveAvatarUrl = (raw?: string | null) => {
  if (!raw) return defaultAvatar
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
    Object.assign(userInfo, { name: updated?.name || editForm.name, phone: updated?.phone || editForm.phone, email: updated?.email || editForm.email, department: updated?.department || editForm.department })
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
    Object.assign(userInfo, { name: data.name || '', studentId: data.studentId || '', department: data.department || '', phone: data.phone || '', email: data.email || '', avatar: resolveAvatarUrl(data.avatar) })

    const statsResp: any = await getUserProfileStats()
    const statsData = statsResp?.data ?? statsResp
    stats.value = { examCount: statsData?.examCount ?? 0, passCount: statsData?.passCount ?? 0, certCount: statsData?.certCount ?? 0 }
  } catch (err: any) {
    ElMessage.error(err?.message || '加载用户信息失败')
  }
})
</script>

<style scoped>
.desktop-profile {
  padding: 0;
}

/* 用户信息卡片 */
.profile-card {
  display: flex;
  gap: 24px;
  padding: 24px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.el-avatar {
  cursor: pointer;
  transition: transform 0.2s;
}

.el-avatar:hover {
  transform: scale(1.05);
}

.avatar-tip {
  font-size: 12px;
  color: #909399;
}

.info-section {
  flex: 1;
}

.user-name {
  font-size: 22px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 16px 0;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #606266;
}

.info-item .el-icon {
  font-size: 16px;
  color: #909399;
}

.action-btns {
  display: flex;
  gap: 12px;
}

/* 统计数据 */
.stats-row {
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.stat-icon .el-icon {
  font-size: 20px;
  color: #fff;
}

.stat-icon.primary { background: #0475FA; }
.stat-icon.success { background: #67c23a; }
.stat-icon.warning { background: #e6a23c; }

.stat-num {
  font-size: 28px;
  font-weight: 700;
  color: #0475FA;
  line-height: 1.2;
}

.stat-num.success { color: #67c23a; }
.stat-num.warning { color: #e6a23c; }

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

/* 快捷功能 */
.quick-section {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-item:hover {
  background: #ecf5ff;
}

.quick-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.quick-icon .el-icon {
  font-size: 20px;
  color: #fff;
}

.quick-title {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}
</style>
