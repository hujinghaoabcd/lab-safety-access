<template>
  <div class="login-page">
    <div class="login-container">
      <!-- 左侧品牌区 -->
      <div class="login-left">
        <div class="logo-section">
          <div class="logo-icon">🔬</div>
          <h1 class="system-title">实验室安全教育考试系统</h1>
          <p class="system-subtitle">Laboratory Safety Education Examination System</p>
        </div>
        <div class="feature-list">
          <div class="feature-item">
            <el-icon><Reading /></el-icon>
            <span>在线学习安全知识</span>
          </div>
          <div class="feature-item">
            <el-icon><EditPen /></el-icon>
            <span>参加安全考核评测</span>
          </div>
          <div class="feature-item">
            <el-icon><Medal /></el-icon>
            <span>获取安全合格证书</span>
          </div>
        </div>
      </div>

      <!-- 右侧登录区 -->
      <div class="login-right">
        <div class="login-form-wrapper">
          <h2 class="login-title">用户登录</h2>
          <p class="login-subtitle">请输入您的账号和密码</p>

          <el-form ref="formRef" :model="form" :rules="rules" class="login-form">
            <el-form-item prop="username">
              <el-input 
                v-model="form.username" 
                placeholder="请输入用户名/学号/工号"
                size="large"
                :prefix-icon="User"
              />
            </el-form-item>
            <el-form-item prop="password">
              <el-input 
                v-model="form.password" 
                type="password"
                placeholder="请输入密码"
                size="large"
                :prefix-icon="Lock"
                show-password
                @keyup.enter="handleLogin"
              />
            </el-form-item>
            <el-form-item>
              <el-button 
                type="primary" 
                class="login-button"
                :loading="loading"
                @click="handleLogin"
              >
                {{ loading ? '登录中...' : '登 录' }}
              </el-button>
            </el-form-item>
          </el-form>

          <p class="login-tip">提示：初始密码由管理员统一设置</p>
        </div>

        <p class="copyright">© 2025 实验室安全教育考试系统</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance } from 'element-plus'
import { User, Lock, Reading, EditPen, Medal } from '@element-plus/icons-vue'
import { login } from '@/api/auth'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
  username: '',
  password: ''
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

// 处理头像URL
const resolveAvatarUrl = (raw?: string | null) => {
  if (!raw) return ''
  if (raw.startsWith('http')) return raw
  if (raw.startsWith('/uploads')) return '/api' + raw
  return raw
}

const handleLogin = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        const resp: any = await login({
          username: form.username,
          password: form.password
        })
        const data = resp?.data ?? resp
        
        const user = data.userInfo || data.user
        if (!user) throw new Error('登录成功但未返回用户信息')

        userStore.setUserInfo({
          id: String(user?.id ?? ''),
          name: user?.name || '',
          studentId: user?.studentId || '',
          department: user?.department || '',
          avatar: resolveAvatarUrl(user?.avatar) || '',
          phone: user?.phone || '',
          email: user?.email || ''
        } as any)

        ElMessage.success('登录成功')
        router.push('/dashboard')
      } catch (err: any) {
        ElMessage.error(err?.message || '登录失败')
      } finally {
        loading.value = false
      }
    }
  })
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0475FA 0%, #667eea 100%);
  padding: 20px;
}

.login-container {
  display: flex;
  width: 880px;
  min-height: 480px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
}

/* 左侧品牌区 */
.login-left {
  flex: 1;
  background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
  padding: 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: #fff;
}

.logo-section {
  text-align: center;
  margin-bottom: 32px;
}

.logo-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.system-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.system-subtitle {
  font-size: 11px;
  opacity: 0.7;
  margin: 0;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 13px;
}

.feature-item .el-icon {
  font-size: 18px;
}

/* 右侧登录区 */
.login-right {
  width: 360px;
  padding: 40px;
  display: flex;
  flex-direction: column;
}

.login-form-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.login-title {
  font-size: 22px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 6px 0;
  text-align: center;
}

.login-subtitle {
  font-size: 13px;
  color: #64748b;
  margin: 0 0 28px 0;
  text-align: center;
}

.login-form :deep(.el-input__wrapper) {
  border-radius: 8px;
  padding: 2px 12px;
}

.login-form :deep(.el-input__inner) {
  height: 38px;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.login-button {
  width: 100%;
  height: 42px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 8px;
  background: #0475FA;
  border: none;
}

.login-button:hover {
  background: #0066d6;
}

.login-tip {
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
  margin: 12px 0 0 0;
}

.copyright {
  text-align: center;
  font-size: 11px;
  color: #94a3b8;
  margin: 0;
  padding-top: 16px;
  border-top: 1px solid #f1f5f9;
}
</style>
