<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { useUserStore } from '../stores/user'
import { getUserProfile, updateUserProfile, getUserProfileStats, changePassword, uploadAvatar } from '../api'

const router = useRouter()
const userStore = useUserStore()

// 用户信息（从后端加载）
const userInfo = reactive({
  name: '',
  studentId: '',
  department: '',
  phone: '',
  email: '',
  avatar: 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'
})
const defaultAvatar = userInfo.avatar

// 编辑表单
const editForm = reactive({
  name: '',
  phone: '',
  email: '',
  department: ''
})

// 显示编辑弹窗
const showEditPopup = ref(false)

// 头像上传
const avatarInputRef = ref<HTMLInputElement | null>(null)

// 修改密码表单
const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})
const showPasswordPopup = ref(false)

// 统计数据
const stats = ref({
  examCount: 0,
  passCount: 0,
  certCount: 0
})

// 菜单项
const menuItems = [
  { icon: 'medal-o', title: '我的证书', path: '/certificate', color: '#FFB800' },
  { icon: 'orders-o', title: '考试记录', path: '/records', color: '#07C160' },
  { icon: 'edit', title: '错题本', path: '/wrongbook', color: '#FA5151' },
  { icon: 'chart-trending-o', title: '排行榜', path: '/ranking', color: '#0475FA' }
]

const navigateTo = (path: string) => {
  router.push(path)
}

// 规范化头像地址：后端返回 /uploads/... 时在前端加上 /api 前缀，方便通过代理访问
const resolveAvatarUrl = (raw?: string | null) => {
  if (!raw) return defaultAvatar
  if (raw.startsWith('http')) return raw
  return '/api' + raw
}

const handleAvatarClick = () => {
  console.log('[Profile] handleAvatarClick')
  if (avatarInputRef.value) {
    avatarInputRef.value.click()
  }
}

const handleAvatarChange = async (event: Event) => {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0]
  if (!file) {
    showToast('请选择图片文件')
    return
  }

  try {
    console.log('[Profile] handleAvatarChange file:', file.name, file.size)
    const resp: any = await uploadAvatar(file)
    const data = resp?.data ?? resp
    console.log('[Profile] uploadAvatar response:', resp)

    if (data?.avatar) {
      const resolved = resolveAvatarUrl(data.avatar)
      userInfo.avatar = resolved
      if (userStore.userInfo) {
        userStore.setUserInfo({
          ...userStore.userInfo,
          avatar: resolved
        } as any)
      }
      showToast('头像更新成功')
    } else {
      showToast('头像更新失败：无有效地址')
    }
  } catch (err: any) {
    console.error('[Profile] handleAvatarChange error:', err)
    showToast(err?.message || '头像上传失败')
  } finally {
    if (avatarInputRef.value) {
      avatarInputRef.value.value = ''
    }
  }
}

// 打开编辑弹窗
const openEdit = () => {
  console.log('[Profile] openEdit, current userInfo:', JSON.parse(JSON.stringify(userInfo)))
  editForm.name = userInfo.name
  editForm.phone = userInfo.phone
  editForm.email = userInfo.email
  editForm.department = userInfo.department
  showEditPopup.value = true
}

// 保存编辑
const saveEdit = async () => {
  if (!editForm.name.trim()) {
    showToast('请输入姓名')
    return
  }
  if (!editForm.phone.trim()) {
    showToast('请输入手机号')
    return
  }

  try {
    console.log('[Profile] saveEdit payload:', {
      name: editForm.name,
      phone: editForm.phone,
      email: editForm.email,
      department: editForm.department
    })
    const resp: any = await updateUserProfile({
      name: editForm.name,
      phone: editForm.phone,
      email: editForm.email,
      department: editForm.department
    })
    const updated = resp?.data ?? resp
    console.log('[Profile] saveEdit response:', resp)

    // 根据后端 userController.updateProfile 返回结构同步本地
    userInfo.name = updated?.name || editForm.name
    userInfo.phone = updated?.phone || editForm.phone
    userInfo.email = updated?.email || editForm.email
    userInfo.department = updated?.department || editForm.department

    // 同步到全局 userStore，方便其他页面使用
    if (userStore.userInfo) {
      userStore.setUserInfo({
        ...userStore.userInfo,
        name: userInfo.name,
        department: userInfo.department,
        phone: userInfo.phone,
        email: userInfo.email
      } as any)
    }

    showEditPopup.value = false
    showToast('保存成功')
  } catch (err: any) {
    console.error('[Profile] saveEdit error:', err)
    showToast(err?.message || '保存失败，请稍后重试')
  }
}

const openPasswordPopup = () => {
  passwordForm.oldPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  showPasswordPopup.value = true
}

const savePassword = async () => {
  if (!passwordForm.oldPassword) {
    showToast('请输入旧密码')
    return
  }
  if (!passwordForm.newPassword) {
    showToast('请输入新密码')
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    showToast('两次输入的新密码不一致')
    return
  }

  try {
    console.log('[Profile] savePassword payload:', {
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword
    })
    await changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword
    })
    console.log('[Profile] changePassword success')
    showPasswordPopup.value = false
    showToast('密码修改成功')
  } catch (err: any) {
    console.error('[Profile] savePassword error:', err)
    showToast(err?.message || '密码修改失败')
  }
}

// 退出登录
const handleLogout = async () => {
  try {
    await showConfirmDialog({
      title: '退出登录',
      message: '确定要退出登录吗？'
    })
    userStore.logout()
    showToast('已退出登录')
    router.replace('/login')
  } catch {
    // 取消
  }
}

// 页面加载时，从后端拉取最新用户信息
onMounted(async () => {
  try {
    console.log('[Profile] onMounted, store.userInfo =', userStore.userInfo)
    const profileResp: any = await getUserProfile()
    const data = profileResp?.data ?? profileResp
    console.log('[Profile] getUserProfile response:', profileResp)

    // 后端 userController.getProfile 返回的字段包括：id, name, studentId, department, phone, email, avatar 等
    userInfo.name = data?.name || ''
    userInfo.studentId = data?.studentId || ''
    userInfo.department = data?.department || ''
    userInfo.phone = data?.phone || ''
    userInfo.email = data?.email || ''
    userInfo.avatar = resolveAvatarUrl(data?.avatar)

    // 同步到全局 store，供其它页面使用（如 Dashboard 计算院系/班级）
    userStore.setUserInfo({
      id: String(data?.id ?? ''),
      name: data?.name || '',
      studentId: data?.studentId || '',
      department: data?.department || '',
      avatar: resolveAvatarUrl(data?.avatar || userInfo.avatar),
      phone: data?.phone || '',
      email: data?.email || ''
    } as any)

    // 获取统计数据
    const statsResp: any = await getUserProfileStats()
    const statsData = statsResp?.data ?? statsResp
    console.log('[Profile] getUserProfileStats response:', statsResp)
    stats.value.examCount = statsData.examCount
    stats.value.passCount = statsData.passCount
    stats.value.certCount = statsData.certCount

  } catch (err: any) {
    console.error('[Profile] onMounted data loading error:', err)
    showToast(err?.message || '加载页面数据失败')
  }
})
</script>

<template>
  <div class="profile-page">
    <!-- 顶部用户信息 -->
    <div class="header">
      <div class="header-bg"></div>
      <div class="user-card">
        <div class="avatar-wrap" @click="handleAvatarClick">
          <van-image round width="18vw" height="18vw" :src="userInfo.avatar" fit="cover" />
          <div class="edit-badge">
            <van-icon name="edit" size="3vw" />
          </div>
        </div>
        <div class="user-main">
          <h2 class="user-name">{{ userInfo.name }}</h2>
          <p class="user-id">学号：{{ userInfo.studentId }}</p>
          <p class="user-dept">{{ userInfo.department }}</p>
        </div>
      </div>
    </div>

    <!-- 统计数据 -->
    <div class="stats-section">
      <div class="stat-item">
        <span class="stat-value">{{ stats.examCount }}</span>
        <span class="stat-label">考试次数</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-value success">{{ stats.passCount }}</span>
        <span class="stat-label">通过次数</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-value primary">{{ stats.certCount }}</span>
        <span class="stat-label">获得证书</span>
      </div>
    </div>

    <!-- 基本信息 -->
    <div class="section">
      <div class="section-title">
        <van-icon name="contact-o" />
        <span>基本信息</span>
        <span class="edit-btn" @click="openEdit">编辑</span>
      </div>
      <div class="info-list">
        <div class="info-row">
          <span class="info-label">手机号码</span>
          <span class="info-value">{{ userInfo.phone || '暂无' }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">电子邮箱</span>
          <span class="info-value">{{ userInfo.email || '暂无' }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">所属学院</span>
          <span class="info-value">{{ userInfo.department }}</span>
        </div>
      </div>
    </div>

    <!-- 功能菜单 -->
    <div class="section">
      <div class="section-title">
        <van-icon name="apps-o" />
        <span>常用功能</span>
      </div>
      <div class="menu-grid">
        <div
          v-for="item in menuItems"
          :key="item.path"
          class="menu-item"
          @click="navigateTo(item.path)"
        >
          <div class="menu-icon" :style="{ background: item.color + '15', color: item.color }">
            <van-icon :name="item.icon" size="6vw" />
          </div>
          <span class="menu-text">{{ item.title }}</span>
        </div>
      </div>
    </div>

    <!-- 其他设置 -->
    <div class="section">
      <div class="section-title">
        <van-icon name="setting-o" />
        <span>其他设置</span>
      </div>
      <van-cell-group :border="false">
        <van-cell title="修改密码" icon="lock" is-link @click="openPasswordPopup" />
        <van-cell title="关于系统" icon="info-o" is-link @click="navigateTo('/about')" />
        <!-- <van-cell title="帮助反馈" icon="service-o" is-link @click="navigateTo('/help')" /> -->
      </van-cell-group>
    </div>

    <!-- 退出按钮 -->
    <div class="logout-section">
      <van-button type="danger" plain block @click="handleLogout">
        退出登录
      </van-button>
    </div>

    <!-- 隐藏的头像上传 input -->
    <input
      ref="avatarInputRef"
      type="file"
      accept="image/*"
      style="display: none"
      @change="handleAvatarChange"
    />

    <!-- 编辑资料弹窗 -->
    <van-popup
      :show="showEditPopup"
      @update:show="val => (showEditPopup = val)"
      position="bottom"
      round
      :style="{ height: '70%' }"
    >
      <div class="edit-popup">
        <div class="popup-header">
          <span class="cancel" @click="showEditPopup = false">取消</span>
          <span class="title">编辑资料</span>
          <span class="save" @click="saveEdit">保存</span>
        </div>
        <div class="popup-content">
          <van-field v-model="editForm.name" label="姓名" placeholder="请输入姓名" />
          <van-field v-model="editForm.phone" label="手机号" placeholder="请输入手机号" type="tel" />
          <van-field v-model="editForm.email" label="邮箱" placeholder="请输入邮箱" type="email" />
          <van-field v-model="editForm.department" label="学院" placeholder="请输入学院" />
        </div>
      </div>
    </van-popup>

    <!-- 修改密码弹窗 -->
    <van-popup
      :show="showPasswordPopup"
      @update:show="val => (showPasswordPopup = val)"
      position="bottom"
      round
      :style="{ height: '60%' }"
    >
      <div class="edit-popup">
        <div class="popup-header">
          <span class="cancel" @click="showPasswordPopup = false">取消</span>
          <span class="title">修改密码</span>
          <span class="save" @click="savePassword">保存</span>
        </div>
        <div class="popup-content">
          <van-field v-model="passwordForm.oldPassword" label="旧密码" placeholder="请输入旧密码" type="password" />
          <van-field v-model="passwordForm.newPassword" label="新密码" placeholder="请输入新密码" type="password" />
          <van-field v-model="passwordForm.confirmPassword" label="确认新密码" placeholder="请再次输入新密码" type="password" />
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.profile-page {
  min-height: 100vh;
  background: #f5f6fa;
  padding-bottom: 8vw;
}

/* 顶部 */
.header {
  position: relative;
  padding-bottom: 12vw;
}

.header-bg {
  height: 30vw;
  background: linear-gradient(135deg, #0475FA 0%, #5ba0f5 100%);
}

.user-card {
  position: absolute;
  top: 15vw;
  left: 4vw;
  right: 4vw;
  background: #fff;
  padding: 5vw;
  display: flex;
  align-items: center;
  gap: 4vw;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}

.avatar-wrap {
  position: relative;
}

.edit-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 6vw;
  height: 6vw;
  background: #0475FA;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  border: 2px solid #fff;
}

.user-main {
  flex: 1;
}

.user-name {
  font-size: 5vw;
  font-weight: 600;
  color: #323233;
  margin: 0 0 1vw 0;
}

.user-id {
  font-size: 3.2vw;
  color: #969799;
  margin: 0 0 0.5vw 0;
}

.user-dept {
  font-size: 3.2vw;
  color: #0475FA;
  margin: 0;
}

/* 统计数据 */
.stats-section {
  display: flex;
  align-items: center;
  background: #fff;
  margin: 4vw;
  padding: 4vw 0;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-divider {
  width: 1px;
  height: 8vw;
  background: #eee;
}

.stat-value {
  font-size: 6vw;
  font-weight: 700;
  color: #323233;
}

.stat-value.success {
  color: #07c160;
}

.stat-value.primary {
  color: #0475FA;
}

.stat-label {
  font-size: 3vw;
  color: #969799;
  margin-top: 1vw;
}

/* 区块 */
.section {
  background: #fff;
  margin: 4vw;
  padding: 4vw;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 2vw;
  font-size: 4vw;
  font-weight: 600;
  color: #323233;
  margin-bottom: 4vw;
  padding-bottom: 3vw;
  border-bottom: 1px solid #f5f5f5;
}

.section-title .edit-btn {
  margin-left: auto;
  font-size: 3.2vw;
  font-weight: 400;
  color: #0475FA;
}

/* 信息列表 */
.info-list {
  display: flex;
  flex-direction: column;
  gap: 3vw;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2vw 0;
}

.info-label {
  font-size: 3.5vw;
  color: #969799;
}

.info-value {
  font-size: 3.5vw;
  color: #323233;
}

/* 功能菜单 */
.menu-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4vw;
}

.menu-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2vw;
}

.menu-icon {
  width: 12vw;
  height: 12vw;
  border-radius: 3vw;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menu-text {
  font-size: 3vw;
  color: #323233;
}

/* 退出按钮 */
.logout-section {
  padding: 8vw 4vw 0;
}

/* 编辑弹窗 */
.edit-popup {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4vw;
  border-bottom: 1px solid #eee;
}

.popup-header .cancel {
  font-size: 4vw;
  color: #969799;
}

.popup-header .title {
  font-size: 4.5vw;
  font-weight: 600;
  color: #323233;
}

.popup-header .save {
  font-size: 4vw;
  color: #0475FA;
  font-weight: 500;
}

.popup-content {
  flex: 1;
  padding: 4vw;
}

.popup-content :deep(.van-field) {
  padding: 3vw 0;
}
</style>
