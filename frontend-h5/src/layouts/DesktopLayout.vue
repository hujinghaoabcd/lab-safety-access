<template>
  <el-container class="desktop-layout">
    <!-- 顶部导航栏 -->
    <el-header class="header">
      <div class="header-content">
        <div class="logo">
          <h2>实验室安全教育考试系统</h2>
        </div>
        <el-menu
          :default-active="activeMenu"
          mode="horizontal"
          class="header-menu"
          @select="handleMenuSelect"
        >
          <el-menu-item index="/dashboard">首页</el-menu-item>
          <el-menu-item index="/learning">学习中心</el-menu-item>
          <el-menu-item index="/exam-center">考试中心</el-menu-item>
          <el-menu-item index="/records">考试记录</el-menu-item>
          <el-menu-item index="/wrongbook">错题本</el-menu-item>
          <el-menu-item index="/ranking">排行榜</el-menu-item>
          <el-menu-item index="/certificate">合格证书</el-menu-item>
        </el-menu>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-avatar :size="36" :src="headerAvatar">
                {{ userInfo?.name?.[0] || userInfo?.studentId?.[0] || 'U' }}
              </el-avatar>
              <span class="username">{{ userInfo?.name || userInfo?.studentId || '用户' }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>
                  个人中心
                </el-dropdown-item>
                <el-dropdown-item command="help">
                  <el-icon><QuestionFilled /></el-icon>
                  帮助说明
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><Switch /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </el-header>

    <!-- 主内容区 -->
    <el-main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getUserProfile } from '@/api/auth'
import {
  ArrowDown,
  User,
  QuestionFilled,
  Switch
} from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const defaultAvatar = 'https://unpkg.com/@vant/assets@1.0.8/cat.jpeg'

const userInfo = computed(() => userStore.userInfo)
const headerAvatar = computed(() => userInfo.value?.avatar || defaultAvatar)

const activeMenu = computed(() => route.path)

const hydrateUserFromBackend = async () => {
  try {
    const response: any = await getUserProfile()
    const data = response?.data ?? response
    if (!data) return

    userStore.setUserInfo({
      id: String(data.id ?? userStore.userInfo?.id ?? ''),
      name: data.name || userStore.userInfo?.name || '',
      studentId: data.studentId || userStore.userInfo?.studentId || '',
      department: data.department || userStore.userInfo?.department || '',
      avatar: data.avatar || null,
      phone: data.phone || '',
      email: data.email || ''
    })
  } catch (err) {
    console.warn('桌面端用户信息同步失败:', err)
  }
}

onMounted(() => {
  hydrateUserFromBackend()
})

const handleMenuSelect = (key: string) => {
  router.push(key)
}

const handleCommand = (command: string) => {
  switch (command) {
    case 'profile':
      router.push('/profile')
      break
    case 'help':
      router.push('/help')
      break
    case 'logout':
      handleLogout()
      break
  }
}

const handleLogout = async () => {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    userStore.logout()
    router.replace('/login')
    ElMessage.success('已退出登录')
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.desktop-layout {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
}

.header {
  background: linear-gradient(135deg, #0475FA 0%, #1a8cff 100%);
  padding: 0;
  height: 70px;
  line-height: 70px;
  box-shadow: 0 4px 20px rgba(4, 117, 250, 0.15);
  position: sticky;
  top: 0;
  z-index: 1000;
  backdrop-filter: blur(10px);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 32px;
  height: 100%;
}

.logo h2 {
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  letter-spacing: 0.5px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-menu {
  flex: 1;
  background: transparent;
  border: none !important;
  margin: 0 50px;
}

.header-menu :deep(.el-menu--horizontal),
.header-menu :deep(.el-menu--horizontal.el-menu) {
  border-bottom: none !important;
}

.header-menu :deep(.el-menu-item) {
  color: rgba(255, 255, 255, 0.85);
  border: none !important;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.2s ease;
  margin: 0 2px;
  padding: 0 20px;
  height: 70px;
  line-height: 70px;
  background: transparent !important;
}

.header-menu :deep(.el-menu-item::after) {
  display: none !important;
}

.header-menu :deep(.el-menu-item:hover) {
  color: #fff;
  background: transparent !important;
}

.header-menu :deep(.el-menu-item.is-active) {
  color: #fff;
  background: transparent !important;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #fff;
  cursor: pointer;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
}

.user-info:hover,
.user-info:focus,
.user-info:active {
  background: transparent;
  border: 0;
  outline: none;
  box-shadow: none;
  transform: none;
}

.username {
  font-size: 14px;
  font-weight: 500;
}

.main-content {
  max-width: 1600px;
  margin: 0 auto;
  padding: 32px;
  width: 100%;
  min-height: calc(100vh - 70px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>

<style>
/* 桌面端统一使用直角信息卡片和直角 Dialog；头像仍保持圆形。 */
@media (min-width: 768px) {
  .desktop-layout .el-card,
  .desktop-layout [class$="-card"],
  .desktop-layout [class*="-card "] {
    border-radius: 0 !important;
  }

  .el-dialog,
  .el-message-box {
    border-radius: 0 !important;
  }
}
</style>
