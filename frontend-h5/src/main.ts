import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// Element Plus
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

// Vant 全局样式与弹窗配置
import {
  closeDialog,
  closeToast,
  setDialogDefaultOptions,
  setToastDefaultOptions
} from 'vant'
import 'vant/lib/index.css'
// Toast / Dialog 属于函数式组件。即使已经引入 Vant 全量样式，也显式引入它们的
// 组件样式，避免自动按需组件与函数式调用组合时出现样式缺失或加载顺序异常。
import 'vant/es/toast/style'
import 'vant/es/dialog/style'

// 移动端确认弹窗默认使用缩放离场动画。路由立即切换到登录页时，
// 缩放中的白色 Dialog 会短暂呈现为一个“小白框”。改为纯淡入淡出，
// 保持弹窗尺寸不发生收缩，避免退出登录时的视觉闪烁。
setDialogDefaultOptions({
  transition: 'van-fade'
})

// 部分 Android 内置 WebView 对 Vant Toast 的 fit-content + transition 组合存在
// 合成层异常：只绘制 Popup 的白色底层，却没有正确绘制 Toast 背景和文字。
// 给所有 Toast 加稳定类并关闭 Toast 自身过渡，具体视觉样式在 global.css 中兜底。
setToastDefaultOptions({
  duration: 2200,
  transition: 'none',
  className: 'app-stable-toast'
})
setToastDefaultOptions('loading', {
  duration: 0,
  transition: 'none',
  className: 'app-stable-toast',
  forbidClick: true
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
import './styles/desktop-certificate-polish.css'
import './styles/desktop-record-detail-polish.css'
import './styles/desktop-exam-center-polish.css'

const app = createApp(App)

// 注册 Element Plus，并统一使用简体中文语言包。
// 分页器、日期选择器、上传等组件默认文案不再出现 Total / Go to / page 等英文。
app.use(ElementPlus, {
  locale: zhCn
})

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)

app.mount('#app')
