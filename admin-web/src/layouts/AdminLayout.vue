<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import adminAvatar from '@/assets/admin.jpeg'
import * as adminApi from '@/api/admin'

const router = useRouter()
const route = useRoute()

const isCollapse = ref(false)
const activeMenu = computed(() => route.path)
const systemTitle = ref('实验室安全教育后台管理系统')

// 加载系统设置
onMounted(async () => {
  try {
    const res: any = await adminApi.getSettings()
    const data = res?.data || res
    if (data?.basic?.siteName) {
      systemTitle.value = data.basic.siteName
    }
  } catch (err) {
    console.error('加载系统设置失败:', err)
  }
})

const menuItems = [
  { path: '/dashboard', title: '首页', icon: 'Odometer' },
  { path: '/users', title: '用户管理', icon: 'User' },
  { path: '/management', title: '班级管理', icon: 'OfficeBuilding' },
  { path: '/questions', title: '题库管理', icon: 'Collection' },
  { path: '/exams', title: '考试管理', icon: 'Document' },
  { path: '/records', title: '考试记录', icon: 'Tickets' },
  { path: '/certificates', title: '证书管理', icon: 'Medal' },
  { path: '/learning-materials', title: '学习资料管理', icon: 'Reading' },
  { path: '/settings', title: '系统设置', icon: 'Setting' }
]

const handleLogout = async () => {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    localStorage.removeItem('admin_token')
    router.replace('/login')
  } catch {
    // 取消
  }
}
</script>

<template>
  <el-container class="admin-layout">
    <!-- 头部 -->
    <el-header class="header">
      <div class="header-left">
        <span class="system-title">{{ systemTitle }}</span>
      </div>
      
      <div class="header-right">
        <el-dropdown>
          <div class="user-info">
            <el-avatar :size="32" :src="adminAvatar" />
            <span>超级管理员</span>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="handleLogout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>

    <el-container class="content-container">
      <!-- 侧边栏 -->
      
      <el-aside :width="isCollapse ? '64px' : '220px'" class="sidebar">
        <el-menu
          :default-active="activeMenu"
          :collapse="isCollapse"
          background-color="#fff"
          text-color="#606266"
          active-text-color="#0475FA"
          router
        >
          <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
            <el-icon><component :is="item.icon" /></el-icon>
            <template #title>{{ item.title }}</template>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <!-- 主内容 -->
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style lang="scss" scoped>
.admin-layout {
  height: 100vh;
  width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  
  :deep(.el-header) {
    padding: 0;
    flex-shrink: 0;
  }
}

.content-container {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
  
  :deep(.el-aside) {
    height: 100%;
  }
  
  :deep(.el-main) {
    height: 100%;
  }
}

.sidebar {
  background: #fff;
  transition: width 0.3s;
  overflow: hidden;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);
  height: 100%;
  
  .el-menu {
    border-right: none;
    background: #fff !important;
    padding-top: 10px;
    
    .el-menu-item {
      color: #606266 !important;
      
      &.is-active {
        background: rgba(4, 117, 250, 0.1) !important;
        color: #0475FA !important;
        
        .el-icon {
          color: #0475FA !important;
        }
      }
      
      &:hover {
        background: #f5f7fa !important;
        color: #0475FA !important;
        
        .el-icon {
          color: #0475FA !important;
        }
      }
      
      .el-icon {
        color: inherit;
      }
    }
  }
}

.header {
  background: #2467FE;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  height: 64px !important;
  width: 100% !important;
  min-width: 0;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
  border-radius: 0;
  box-sizing: border-box;
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    
    .system-title {
      color: #fff;
      font-size: 18px;
      font-weight: 600;
      white-space: nowrap;
      margin-left: 12px;
      padding-left: 10px;
    }
  }
  
  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
    
    .icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(93, 173, 226, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s ease;
      
      .el-icon {
        color: #fff;
        font-size: 18px;
      }
      
      &:hover {
        background: rgba(93, 173, 226, 0.5);
      }
    }
    
    :deep(.el-dropdown) {
      outline: none !important;
      
      &:focus,
      &:active {
        outline: none !important;
      }
    }
    
    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      border: none !important;
      outline: none !important;
      
      &:hover,
      &:focus,
      &:active,
      &:focus-visible {
        border: none !important;
        outline: none !important;
        box-shadow: none !important;
      }
      
      span {
        font-size: 14px;
        color: #fff;
        font-weight: 500;
      }
    }
  }
}

.main-content {
  background: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
  height: 100%;
}
</style>

