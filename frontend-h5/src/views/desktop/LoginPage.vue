<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { login } from '@/api/auth'
import { useUserStore } from '@/stores/user'
import logo2 from '@/assets/logo6.svg'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref<FormInstance>()
const loading = ref(false)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationFrameId: number | null = null

const form = reactive({
  username: '',
  password: ''
})

const rules = {
  username: [{ required: true, message: '请输入用户名/学号/工号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

let particles: Particle[] = []
let mouseX = 0
let mouseY = 0

const initParticles = () => {
  if (!canvasRef.value) return

  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  particles = []
  const particleCount = 80

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: Math.random() * 2 + 1
    })
  }
}

const drawParticles = () => {
  if (!canvasRef.value) return

  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  for (let i = 0; i < particles.length; i++) {
    const p1 = particles[i]

    p1.x += p1.vx
    p1.y += p1.vy

    if (p1.x < 0 || p1.x > canvas.width) p1.vx *= -1
    if (p1.y < 0 || p1.y > canvas.height) p1.vy *= -1

    const dx = mouseX - p1.x
    const dy = mouseY - p1.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance < 100) {
      p1.vx -= dx * 0.0001
      p1.vy -= dy * 0.0001
    }

    ctx.beginPath()
    ctx.arc(p1.x, p1.y, p1.radius, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(160, 174, 192, 0.5)'
    ctx.fill()

    for (let j = i + 1; j < particles.length; j++) {
      const p2 = particles[j]
      const lineDx = p2.x - p1.x
      const lineDy = p2.y - p1.y
      const lineDistance = Math.sqrt(lineDx * lineDx + lineDy * lineDy)

      if (lineDistance < 150) {
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.strokeStyle = `rgba(160, 174, 192, ${0.4 * (1 - lineDistance / 150)})`
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
  }

  animationFrameId = requestAnimationFrame(drawParticles)
}

const handleMouseMove = (e: MouseEvent) => {
  mouseX = e.clientX
  mouseY = e.clientY
}

const handleResize = () => {
  if (!canvasRef.value) return
  canvasRef.value.width = window.innerWidth
  canvasRef.value.height = window.innerHeight
  initParticles()
}

onMounted(() => {
  initParticles()
  drawParticles()
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId)
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('resize', handleResize)
})

const resolveAvatarUrl = (raw?: string | null) => {
  if (!raw) return ''
  if (raw.startsWith('http')) return raw
  if (raw.startsWith('/uploads')) return '/api' + raw
  return raw
}

const handleLogin = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    loading.value = true

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
    if (err?.message && !String(err.message).includes('校验')) {
      console.error('登录失败:', err)
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <canvas ref="canvasRef" class="particles-canvas"></canvas>

    <div class="login-card">
      <div class="login-illustration">
        <img :src="logo2" alt="illustration" class="illustration-img" />
      </div>

      <div class="login-form-section">
        <div class="login-content">
          <h1 class="login-title">实验室安全教育考试系统</h1>

          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            class="login-form"
            @keyup.enter="handleLogin"
          >
            <el-form-item prop="username">
              <el-input
                v-model="form.username"
                placeholder="请输入用户名/学号/工号"
                size="large"
                class="login-input"
              >
                <template #prefix>
                  <el-icon><User /></el-icon>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item prop="password">
              <el-input
                v-model="form.password"
                type="password"
                placeholder="请输入密码"
                size="large"
                class="login-input"
                show-password
              >
                <template #prefix>
                  <el-icon><Lock /></el-icon>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                size="large"
                :loading="loading"
                class="login-btn"
                @click="handleLogin"
              >
                登录
              </el-button>
            </el-form-item>
          </el-form>

          <div class="login-tip">提示：初始密码由管理员统一设置</div>

          <div class="login-copyright">
            © 2025 中国科学院大学生命科学学院
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  background: #f5f7fa;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  position: relative;
  overflow: hidden;
}

.login-card {
  width: 60%;
  max-width: 1100px;
  height: 500px;
  background: #2467FE;
  border-radius: 0;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  display: flex;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

.login-illustration {
  width: 53%;
  background: none;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.illustration-img {
  width: 77%;
  height: 77%;
  object-fit: contain;
  display: block;
}

.login-form-section {
  width: 55%;
  padding: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: #fff;
  position: relative;
}

.login-content {
  width: 100%;
  max-width: 420px;
  padding: 50px 60px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
}

.login-title {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 40px 0;
  text-align: center;
  letter-spacing: 0.5px;
  line-height: 1.4;
}

.login-form {
  width: 100%;

  .el-form-item {
    margin-bottom: 20px;

    &:last-of-type {
      margin-bottom: 0;
      margin-top: 8px;
    }
  }

  .login-input {
    :deep(.el-input__wrapper) {
      border-radius: 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      padding: 12px 16px;
      height: 48px;
      transition: all 0.3s ease;

      &:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
      }

      &.is-focus {
        box-shadow: 0 4px 16px rgba(4, 117, 250, 0.2);
      }
    }

    :deep(.el-input__inner) {
      font-size: 15px;
      line-height: 1.5;
    }

    :deep(.el-input__prefix) {
      margin-right: 12px;

      .el-icon {
        font-size: 18px;
        color: #909399;
      }
    }
  }

  .login-btn {
    width: 100%;
    height: 50px;
    font-size: 16px;
    font-weight: 500;
    border-radius: 0;
    background: #0475FA;
    border: none;
    margin-top: 10px;
    transition: all 0.3s ease;

    &:hover {
      background: #3d93fc;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(4, 117, 250, 0.3);
    }

    &:active {
      transform: translateY(0);
    }
  }
}

.login-tip {
  margin-top: 14px;
  text-align: center;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.login-copyright {
  margin-top: 16px;
  text-align: center;
  font-size: 13px;
  color: #909399;
  line-height: 1.5;
  padding-top: 20px;
}

@media (max-width: 768px) {
  .login-card {
    flex-direction: column;
    height: auto;
    max-height: 90vh;
  }

  .login-illustration {
    width: 100%;
    height: 200px;
  }

  .login-form-section {
    width: 100%;
    padding: 0;
  }

  .login-content {
    padding: 40px 30px;
    max-width: 100%;
  }

  .login-title {
    font-size: 20px;
    margin-bottom: 30px;
  }

  .login-copyright {
    margin-top: 20px;
    padding-top: 15px;
    font-size: 12px;
  }
}
</style>

<style lang="scss">
.particles-canvas {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  z-index: 0;
}
</style>
