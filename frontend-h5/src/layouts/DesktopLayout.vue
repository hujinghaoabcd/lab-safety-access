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
              <el-avatar :size="32" :src="userInfo?.avatar">
                {{ userInfo?.name?.[0] || 'U' }}
              </el-avatar>
              <span class="username">{{ userInfo?.name || '用户' }}</span>
              <el-icon><arrow-down /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><user /></el-icon>
                  个人中心
                </el-dropdown-item>
                <el-dropdown-item command="help">
                  <el-icon><question-filled /></el-icon>
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
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowDown,
  User,
  QuestionFilled,
  Switch
} from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const userInfo = computed(() => userStore.userInfo)

const activeMenu = computed(() => {
  return route.path
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
    router.push('/login')
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

.header-menu :deep(.el-menu--horizontal) {
  border-bottom: none !important;
}

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
  padding: 6px 16px;
  border-radius: 0;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.user-info:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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

/* 页面切换动画 */
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
