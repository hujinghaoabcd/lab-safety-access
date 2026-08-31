<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { login } from '@/api/auth'
import { useUserStore } from '@/stores/user'
import logoSvg from '@/assets/logo6.svg'

const router = useRouter()
const userStore = useUserStore()

const formData = ref({
  username: '',
  password: ''
})

const loading = ref(false)
const showPassword = ref(false)

const handleLogin = async () => {
  if (!formData.value.username) {
    showToast('请输入学号')
    return
  }
  if (!formData.value.password) {
    showToast('请输入密码')
    return
  }

  loading.value = true
  try {
    const res = await login(formData.value)
    userStore.setUserInfo(res.data.userInfo)
    showToast('登录成功')
    router.push('/dashboard')
  } catch (error) {
    console.error('Login failed:', error)
  } finally {
    loading.value = false
  }
}

const handleContact = () => {
  showToast('请联系管理员：010-12345678')
}

const togglePassword = () => {
  showPassword.value = !showPassword.value
}
</script>

<template>
  <div class="login-page">
    <!-- 蓝色头部区域 -->
    <div class="header-section">
      <div class="header-content">
        <div class="welcome-text">
          <h1>欢迎登录</h1>
          <!-- <p style="font-size: 1.1em; font-weight: bold;">实验室安全教育考试系统</p> -->
          <p style="font-size: 1.25em; font-weight: bold;">安全教育考试系统</p>
        </div>
        <div class="header-illustration">
          <img :src="logoSvg" alt="logo" class="logo-img" />
        </div>
      </div>
    </div>

    <!-- 白色浮动卡片区域 -->
    <div class="form-wrapper" style="box-shadow: 0 4px 24px rgba(0,0,0,0.13); border-radius: 5px;">
      <div class="form-card" style="box-shadow: 0 8px 32px rgba(0,0,0,0.16); border-radius:5px; width: 90%;">
        <!-- 表单 -->
        <div class="form-content">
          <div class="input-group">
            <div class="input-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#BFBFBF" stroke-width="1.5">
                <rect x="3" y="4" width="18" height="16" rx="1"/>
                <path d="M7 8h10M7 12h10M7 16h6"/>
              </svg> 
            </div>
            <input
              v-model="formData.username"
              type="text"
              placeholder="请输入学号"
              class="input-field"
            />
          </div>

          <div class="input-group">
            <div class="input-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#BFBFBF" stroke-width="1.5">
                <rect x="3" y="11" width="18" height="11" rx="1"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <input
              v-model="formData.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入密码"
              class="input-field"
            />
            <div class="input-suffix" @click="togglePassword">
              <svg v-if="!showPassword" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#BFBFBF" stroke-width="1.5">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
              <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#BFBFBF" stroke-width="1.5">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
          </div>
          <button
            class="login-btn square-btn"
            :disabled="loading"
            @click="handleLogin"
            style="border-radius: 0;"
          >
            {{ loading ? '登录中...' : '登录' }}
          </button>

          <div class="agreement">
            <span class="agreement-text">
              登录及代表同意
              <a href="javascript:;" class="link">《用户协议》</a>
              和
              <a href="javascript:;" class="link">《隐私政策》</a>
            </span>
          </div>
        </div>
      </div>

      <!-- 联系管理员 -->
      <!-- <div class="contact-admin" @click="handleContact">
        联系管理员
      </div> -->

      <!-- 版权信息 -->
      <div class="copyright" style="position: fixed; left: 0; right: 0; bottom: 0; background: #fff;">
        @ 2025 中国科学院大学生命科学学院
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  background: #fff;
  display: flex;
  flex-direction: column;
}

/* 蓝色头部区域 */
.header-section {
  background: #0475FA;
  padding: 12vw 5.333vw 28vw;
  position: relative;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.welcome-text {
  padding-top: 2.667vw;
}

.welcome-text h1 {
  font-size: 7vw;
  font-weight: 600;
  color: #fff;
  margin-bottom: 2.133vw;
  letter-spacing: 0.5px;
}

.welcome-text p {
  font-size: 3.733vw;
  color: rgba(255, 255, 255, 0.9);
}

.header-illustration {
  width: 44vw;
  height: 36vw;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* 白色浮动卡片容器 */
.form-wrapper {
  flex: 1;
  margin-top: -24vw;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 10;
}

/* 书本装饰 */
.books-decoration {
  position: relative;
  z-index: 11;
  margin-bottom: -8vw;
}

.form-card {
  background: #fff;
  border-radius: 0;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
  padding: 12vw 6vw 8vw;
  width: 100%;
}

/* 表单内容 */
.form-content {
  display: flex;
  flex-direction: column;
  gap: 5.333vw;
  max-width: 400px;
  margin: 0 auto;
}

.input-group {
  display: flex;
  align-items: center;
  border: 1px solid #E5E5E5;
  padding: 0 4vw;
  height: 14vw;
  background: #fff;
}

.input-icon {
  margin-right: 3.2vw;
  display: flex;
  align-items: center;
  justify-content: center;
}

.input-field {
  flex: 1;
  border: none;
  outline: none;
  font-size: 4vw;
  color: #333;
  background: transparent;
  height: 100%;
}

.input-field::placeholder {
  color: #BFBFBF;
}

.input-suffix {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 2.667vw;
  cursor: pointer;
}

/* 登录按钮 */
.login-btn {
  margin-top: 4vw;
  height: 13.333vw;
  font-size: 4.533vw;
  font-weight: 500;
  color: #fff;
  background: #0475FA;
  border: none;
  border-radius: 0;
  cursor: pointer;
  transition: opacity 0.2s;
}

.login-btn:active {
  opacity: 0.9;
}

.login-btn:disabled {
  opacity: 0.7;
}

/* 协议 */
.agreement {
  display: flex;
  justify-content: center;
  margin-top: 2vw;
}

.agreement-text {
  font-size: 3.467vw;
  color: #999;
}

.agreement .link {
  color: #0475FA;
  text-decoration: none;
}

/* 联系管理员 */
.contact-admin {
  text-align: center;
  padding: 12vw 0 4vw;
  font-size: 4vw;
  color: #0475FA;
}

/* 版权信息 */
.copyright {
  text-align: center;
  padding: 2.667vw 0 8vw;
  font-size: 3.2vw;
  color: #999;
}
</style>
