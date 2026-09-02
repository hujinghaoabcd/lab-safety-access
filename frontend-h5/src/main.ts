import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// Element Plus
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

// Vant 全局样式与弹窗配置
import { setDialogDefaultOptions } from 'vant'
import 'vant/lib/index.css'

// 移动端确认弹窗默认使用缩放离场动画。路由立即切换到登录页时，
// 缩放中的白色 Dialog 会短暂呈现为一个“小白框”。改为纯淡入淡出，
// 保持弹窗尺寸不发生收缩，避免退出登录时的视觉闪烁。
setDialogDefaultOptions({
  transition: 'van-fade'
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
