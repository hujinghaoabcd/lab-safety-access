import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// Element Plus
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

// Vant 全局样式与弹窗配置
import { closeDialog, closeToast, setDialogDefaultOptions } from 'vant'
import 'vant/lib/index.css'

// 移动端确认弹窗默认使用缩放离场动画。路由立即切换到登录页时，
// 缩放中的白色 Dialog 会短暂呈现为一个“小白框”。改为纯淡入淡出，
// 保持弹窗尺寸不发生收缩，避免退出登录时的视觉闪烁。
setDialogDefaultOptions({
  transition: 'van-fade'
})

// 退出后 ProfilePage 会先产生“已退出登录”Toast，同时确认 Dialog 也可能仍处于
// 离场阶段。它们都会 Teleport 到 body，并跨路由覆盖在登录页中央。进入登录页前
// 主动清理这些瞬态浮层，避免出现遮挡密码框的白色小矩形。
router.beforeEach((to) => {
  if (to.path === '/login') {
    closeToast()
    closeDialog()
  }
  return true
})

// 全局样式
import './styles/global.css'

const app = createApp(App)

// 注册 Element Plus
app.use(ElementPlus)

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)

app.mount('#app')
