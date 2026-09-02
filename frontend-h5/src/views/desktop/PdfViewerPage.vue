<template>
  <div class="desktop-pdf-viewer">
    <section class="viewer-toolbar">
      <div class="toolbar-left">
        <el-button class="back-btn" @click="router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <div class="page-info">
          <span>第</span>
          <strong>{{ currentPage }}</strong>
          <span>/ {{ totalPages || 0 }} 页</span>
        </div>
      </div>

      <div class="toolbar-right">
        <span class="zoom-label">缩放</span>
        <el-button-group class="zoom-group">
          <el-button :disabled="scale <= 0.8" @click="zoomOut">
            <el-icon><ZoomOut /></el-icon>
          </el-button>
          <el-button class="zoom-value" @click="resetZoom">
            {{ Math.round(scale * 100) }}%
          </el-button>
          <el-button :disabled="scale >= 2" @click="zoomIn">
            <el-icon><ZoomIn /></el-icon>
          </el-button>
        </el-button-group>
      </div>
    </section>

    <section class="viewer-panel">
      <div v-if="loading" class="viewer-state">
        <el-icon class="loading-icon"><Loading /></el-icon>
        <span>PDF 加载中...</span>
      </div>

      <div v-else-if="errorMsg" class="viewer-state error-state">
        <el-icon><WarningFilled /></el-icon>
        <strong>学习资料加载失败</strong>
        <span>{{ errorMsg }}</span>
        <el-button @click="router.back()">返回学习中心</el-button>
      </div>

      <div
        v-else
        ref="containerRef"
        class="pdf-container"
        @scroll="handleScroll"
      ></div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  Loading,
  WarningFilled,
  ZoomIn,
  ZoomOut
} from '@element-plus/icons-vue'
// @ts-ignore: Vite 下通过 ?url 导入 worker 路径
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist'
import { getPdfProxyUrl, recordProgress, recordStudyTime } from '@/api/learning'

const route = useRoute()
const router = useRouter()

const containerRef = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const errorMsg = ref('')
const currentPage = ref(1)
const totalPages = ref(0)
const scale = ref(1.2)
const materialId = ref<string | number | null>(null)
const startTime = ref<number | null>(null)

// PDF.js 的 PDFDocumentProxy / PDFPageProxy 不应被 Vue 深度响应式代理。
// 使用 shallowRef 保留原始实例，否则 getPage/render 在部分版本下会因 this 被 Proxy 包装而失败，
// 表现为页数已经读到但内容区完全空白。
const pdfDocument = shallowRef<any>(null)

;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker

let progressTimer: ReturnType<typeof setTimeout> | null = null
let renderSequence = 0

const saveProgress = async (page: number, total: number) => {
  if (!materialId.value || total <= 0) return

  const idStr = String(materialId.value)
  if (idStr.startsWith('demo-') || Number.isNaN(Number(idStr))) return

  const progress = Math.min(100, Math.max(0, Math.floor((page / total) * 100)))

  if (progressTimer) clearTimeout(progressTimer)
  progressTimer = setTimeout(async () => {
    try {
      await recordProgress(idStr, progress)
    } catch (err) {
      console.error('保存学习进度失败:', err)
    }
  }, 1200)
}

const resolvePdfUrl = () => {
  const encoded = route.query.url as string | undefined
  if (!encoded) return ''

  const originalPdfUrl = decodeURIComponent(encoded)
  try {
    const url = new URL(originalPdfUrl)
    return url.origin !== window.location.origin
      ? getPdfProxyUrl(originalPdfUrl)
      : originalPdfUrl
  } catch (_) {
    return originalPdfUrl
  }
}

const renderPdf = async ({ preservePosition = false } = {}) => {
  const container = containerRef.value
  const pdf = pdfDocument.value
  if (!container || !pdf) return

  const sequence = ++renderSequence
  const previousScrollRatio = preservePosition && container.scrollHeight > container.clientHeight
    ? container.scrollTop / (container.scrollHeight - container.clientHeight)
    : 0

  container.innerHTML = ''
  let renderedPages = 0

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    if (sequence !== renderSequence) return

    try {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: scale.value })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) continue

      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      canvas.setAttribute('data-page', String(pageNumber))
      canvas.className = 'pdf-page-canvas'

      await page.render({ canvasContext: context, viewport }).promise

      canvas.style.width = `${Math.round(viewport.width)}px`
      canvas.style.height = `${Math.round(viewport.height)}px`
      canvas.style.display = 'block'
      canvas.style.maxWidth = 'none'
      canvas.style.margin = '0 auto 18px'
      canvas.style.background = '#fff'
      canvas.style.border = '1px solid #d7dde5'
      canvas.style.borderRadius = '0'
      canvas.style.boxShadow = '0 2px 8px rgba(31, 45, 61, 0.08)'

      container.appendChild(canvas)
      renderedPages += 1
    } catch (pageErr) {
      console.error(`页面 ${pageNumber} 渲染失败:`, pageErr)
    }
  }

  if (sequence !== renderSequence) return

  if (renderedPages === 0) {
    errorMsg.value = 'PDF 已打开，但页面渲染失败，请刷新后重试'
    return
  }

  await nextTick()

  if (preservePosition && previousScrollRatio > 0 && container.scrollHeight > container.clientHeight) {
    container.scrollTop = previousScrollRatio * (container.scrollHeight - container.clientHeight)
  }
  updateCurrentPage()
}

const updateCurrentPage = () => {
  const container = containerRef.value
  if (!container || totalPages.value === 0) return

  const pages = Array.from(container.querySelectorAll<HTMLCanvasElement>('[data-page]'))
  if (!pages.length) return

  const target = container.scrollTop + Math.min(container.clientHeight * 0.35, 240)
  let nearestPage = 1
  let nearestDistance = Number.POSITIVE_INFINITY

  pages.forEach((page) => {
    const distance = Math.abs(page.offsetTop - target)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestPage = Number(page.dataset.page || 1)
    }
  })

  if (nearestPage !== currentPage.value) {
    currentPage.value = nearestPage
    saveProgress(nearestPage, totalPages.value)
  }
}

const handleScroll = () => updateCurrentPage()

const zoomIn = async () => {
  if (scale.value >= 2) return
  scale.value = Math.min(2, Math.round((scale.value + 0.1) * 10) / 10)
  await renderPdf({ preservePosition: true })
}

const zoomOut = async () => {
  if (scale.value <= 0.8) return
  scale.value = Math.max(0.8, Math.round((scale.value - 0.1) * 10) / 10)
  await renderPdf({ preservePosition: true })
}

const resetZoom = async () => {
  if (scale.value === 1.2) return
  scale.value = 1.2
  await renderPdf({ preservePosition: true })
}

onMounted(async () => {
  const id = route.query.id as string | undefined
  const pdfUrl = resolvePdfUrl()

  if (!pdfUrl) {
    errorMsg.value = '未提供 PDF 地址'
    loading.value = false
    return
  }

  if (id) {
    materialId.value = id
    startTime.value = Date.now()
  }

  try {
    const rawPdf = await (pdfjsLib as any).getDocument({
      url: pdfUrl,
      httpHeaders: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    }).promise

    pdfDocument.value = rawPdf
    totalPages.value = rawPdf.numPages
    loading.value = false

    await nextTick()
    await nextTick()
    await renderPdf()

    if (materialId.value) saveProgress(1, totalPages.value)
  } catch (err) {
    console.error('加载 PDF 失败:', err)
    errorMsg.value = '请检查资料文件或网络连接后重试'
    ElMessage.error('PDF 加载失败')
    loading.value = false
  }
})

onUnmounted(() => {
  renderSequence += 1
  if (progressTimer) clearTimeout(progressTimer)

  if (materialId.value && startTime.value) {
    const idStr = String(materialId.value)
    if (idStr.startsWith('demo-') || Number.isNaN(Number(idStr))) return

    const studyDuration = Math.floor((Date.now() - startTime.value) / 1000)
    if (studyDuration > 0) {
      recordStudyTime(idStr, studyDuration).catch(err => {
        console.error('保存学习时长失败:', err)
      })
    }
  }
})
</script>

<style scoped>
.desktop-pdf-viewer {
  min-height: calc(100vh - 70px);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.viewer-toolbar,
.viewer-panel {
  background: #fff;
  border: 1px solid #e3e8ef;
}

.viewer-toolbar {
  min-height: 54px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toolbar-left,
.toolbar-right,
.page-info {
  display: flex;
  align-items: center;
}

.toolbar-left {
  gap: 16px;
}

.toolbar-right {
  gap: 10px;
}

.back-btn,
.zoom-group :deep(.el-button) {
  border-radius: 0 !important;
}

.back-btn {
  height: 32px;
  padding: 0 13px;
}

.page-info {
  gap: 5px;
  color: #8a97a8;
  font-size: 13px;
}

.page-info strong {
  color: #26384a;
  font-size: 15px;
}

.zoom-label {
  font-size: 12px;
  color: #9aa5b4;
}

.zoom-group :deep(.el-button) {
  height: 32px;
  min-width: 38px;
  padding: 0 10px;
}

.zoom-group :deep(.zoom-value) {
  min-width: 64px;
  color: #526173;
}

.viewer-panel {
  flex: 1;
  min-height: 620px;
  overflow: hidden;
}

.pdf-container {
  height: calc(100vh - 166px);
  min-height: 600px;
  overflow: auto;
  padding: 22px 24px 8px;
  background: #eef1f5;
  text-align: center;
}

.pdf-container :deep(.pdf-page-canvas) {
  display: block;
  max-width: none;
  margin: 0 auto 18px;
  background: #fff;
  border: 1px solid #d7dde5;
  border-radius: 0 !important;
  box-shadow: 0 2px 8px rgba(31, 45, 61, 0.08);
}

.viewer-state {
  min-height: 620px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #7f8b99;
  font-size: 14px;
}

.loading-icon {
  font-size: 20px;
  color: #0475FA;
  animation: viewer-spin 1s linear infinite;
}

.error-state {
  flex-direction: column;
  gap: 9px;
}

.error-state > .el-icon {
  font-size: 30px;
  color: #e95b67;
}

.error-state strong {
  font-size: 16px;
  color: #334155;
}

.error-state span {
  margin-bottom: 8px;
  color: #98a3b3;
}

.error-state :deep(.el-button) {
  border-radius: 0;
}

@keyframes viewer-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 1100px) {
  .viewer-toolbar {
    padding: 0 12px;
  }

  .pdf-container {
    padding: 18px 16px 6px;
  }
}
</style>
