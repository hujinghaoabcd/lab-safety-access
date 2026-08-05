<template>
  <div class="desktop-pdf-viewer">
    <!-- 顶部工具栏 -->
    <el-card class="toolbar-card" shadow="hover">
      <div class="toolbar-content">
        <div class="toolbar-left">
          <el-button @click="router.back()">
            <el-icon><ArrowLeft /></el-icon>
            返回
          </el-button>
          <div class="page-info">
            第 {{ currentPage }} / {{ totalPages }} 页
          </div>
        </div>
        <div class="toolbar-right">
          <el-button-group>
            <el-button @click="zoomOut" :disabled="scale <= 0.5">
              <el-icon><ZoomOut /></el-icon>
            </el-button>
            <el-button disabled>
              {{ Math.round(scale * 100) }}%
            </el-button>
            <el-button @click="zoomIn" :disabled="scale >= 2">
              <el-icon><ZoomIn /></el-icon>
            </el-button>
          </el-button-group>
        </div>
      </div>
    </el-card>

    <!-- PDF内容区域 -->
    <el-card class="pdf-content-card" shadow="hover">
      <div v-if="loading" class="loading-container">
        <el-loading :loading="loading" text="PDF 加载中..." />
      </div>

      <div v-else-if="errorMsg" class="error-container">
        <el-empty :description="errorMsg" />
      </div>

      <div
        v-else
        ref="containerRef"
        class="pdf-container"
        @scroll="handleScroll"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ZoomOut, ZoomIn } from '@element-plus/icons-vue'
// 使用 pdfjs-dist 进行 PDF 预览
// @ts-ignore: Vite 下通过 ?url 导入 worker 路径
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist'
import { recordProgress, getPdfProxyUrl, recordStudyTime } from '@/api/learning'

const route = useRoute()
const router = useRouter()

const containerRef = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const errorMsg = ref('')
const currentPage = ref(1)
const totalPages = ref(0)
const scale = ref(1.5)
const materialId = ref<string | number | null>(null)
const startTime = ref<number | null>(null)

// 配置 pdf.js 的 worker
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker

// 防抖保存进度
let progressTimer: ReturnType<typeof setTimeout> | null = null
const saveProgress = async (page: number, total: number) => {
  if (!materialId.value) return

  const idStr = String(materialId.value)
  if (idStr.startsWith('demo-') || isNaN(Number(idStr))) {
    console.log('示例数据，跳过保存进度')
    return
  }

  const progress = Math.floor((page / total) * 100)

  if (progressTimer) {
    clearTimeout(progressTimer)
  }

  progressTimer = setTimeout(async () => {
    try {
      await recordProgress(idStr, progress)
    } catch (err) {
      console.error('保存学习进度失败:', err)
    }
  }, 2000)
}

// 滚动监听，更新当前页和进度
const handleScroll = () => {
  if (!containerRef.value || totalPages.value === 0) return

  const container = containerRef.value
  const scrollTop = container.scrollTop
  const scrollHeight = container.scrollHeight
  const clientHeight = container.clientHeight

  const scrollProgress = scrollTop / (scrollHeight - clientHeight)
  const estimatedPage = Math.max(1, Math.min(totalPages.value, Math.ceil(scrollProgress * totalPages.value)))

  if (estimatedPage !== currentPage.value) {
    currentPage.value = estimatedPage
    saveProgress(currentPage.value, totalPages.value)
  }
}

const zoomIn = () => {
  if (scale.value < 2) {
    scale.value += 0.2
    reloadPdf()
  }
}

const zoomOut = () => {
  if (scale.value > 0.5) {
    scale.value -= 0.2
    reloadPdf()
  }
}

const reloadPdf = async () => {
  const encoded = route.query.url as string | undefined
  if (!encoded) return

  const originalPdfUrl = decodeURIComponent(encoded)

  let pdfUrl = originalPdfUrl
  try {
    const url = new URL(originalPdfUrl)
    if (url.origin !== window.location.origin) {
      pdfUrl = getPdfProxyUrl(originalPdfUrl)
    }
  } catch (err) {
    pdfUrl = originalPdfUrl
  }

  const container = containerRef.value
  if (!container) return

  container.innerHTML = ''
  loading.value = true

  try {
    const pdf = await (pdfjsLib as any).getDocument({
      url: pdfUrl,
      httpHeaders: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }).promise
    totalPages.value = pdf.numPages

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      try {
        const page = await pdf.getPage(pageNumber)
        const viewport = page.getViewport({ scale: scale.value })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')

        if (!context) {
          console.error(`页面 ${pageNumber} 无法获取 canvas context`)
          continue
        }

        canvas.width = viewport.width
        canvas.height = viewport.height

        await page
          .render({
            canvasContext: context,
            viewport
          })
          .promise

        const containerWidth = container.clientWidth || window.innerWidth - 100
        const aspectRatio = viewport.width / viewport.height
        const displayHeight = containerWidth / aspectRatio

        canvas.style.width = '100%'
        canvas.style.height = `${displayHeight}px`
        canvas.style.display = 'block'
        canvas.style.marginBottom = '16px'
        canvas.style.maxWidth = '100%'
        canvas.style.backgroundColor = '#fff'
        canvas.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.1)'
        canvas.style.border = '1px solid #e0e0e0'
        canvas.style.borderRadius = '8px'
        canvas.setAttribute('data-page', String(pageNumber))

        container.appendChild(canvas)
      } catch (pageErr) {
        console.error(`页面 ${pageNumber} 渲染失败:`, pageErr)
      }
    }
  } catch (err) {
    console.error('重新加载 PDF 失败:', err)
    ElMessage.error('重新加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  const encoded = route.query.url as string | undefined
  const id = route.query.id as string | undefined

  if (!encoded) {
    errorMsg.value = '未提供 PDF 地址'
    loading.value = false
    return
  }

  if (id) {
    materialId.value = id
    startTime.value = Date.now()
  }

  const originalPdfUrl = decodeURIComponent(encoded)

  let pdfUrl = originalPdfUrl
  try {
    const url = new URL(originalPdfUrl)
    if (url.origin !== window.location.origin) {
      pdfUrl = getPdfProxyUrl(originalPdfUrl)
    }
  } catch (err) {
    pdfUrl = originalPdfUrl
  }

  try {
    const pdf = await (pdfjsLib as any).getDocument({
      url: pdfUrl,
      httpHeaders: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }).promise
    totalPages.value = pdf.numPages
    loading.value = false

    await nextTick()
    await nextTick()

    let container = containerRef.value
    if (!container) {
      await new Promise(resolve => setTimeout(resolve, 200))
      container = containerRef.value
    }

    if (!container) {
      container = document.querySelector('.pdf-container') as HTMLDivElement
    }

    if (!container) {
      errorMsg.value = '无法找到渲染容器，请刷新页面重试'
      return
    }

    container.addEventListener('scroll', handleScroll)

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      try {
        const page = await pdf.getPage(pageNumber)
        const viewport = page.getViewport({ scale: scale.value })

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')

        if (!context) {
          console.error(`页面 ${pageNumber} 无法获取 canvas context`)
          continue
        }

        canvas.width = viewport.width
        canvas.height = viewport.height

        await page
          .render({
            canvasContext: context,
            viewport
          })
          .promise

        const containerWidth = container.clientWidth || window.innerWidth - 100
        const aspectRatio = viewport.width / viewport.height
        const displayHeight = containerWidth / aspectRatio

        canvas.style.width = '100%'
        canvas.style.height = `${displayHeight}px`
        canvas.style.display = 'block'
        canvas.style.marginBottom = '16px'
        canvas.style.maxWidth = '100%'
        canvas.style.backgroundColor = '#fff'
        canvas.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.1)'
        canvas.style.border = '1px solid #e0e0e0'
        canvas.style.borderRadius = '8px'
        canvas.setAttribute('data-page', String(pageNumber))

        container.appendChild(canvas)
      } catch (pageErr) {
        console.error(`页面 ${pageNumber} 渲染失败:`, pageErr)
      }
    }

    if (materialId.value) {
      saveProgress(1, totalPages.value)
    }
  } catch (err) {
    console.error('加载 PDF 失败:', err)
    errorMsg.value = 'PDF 加载失败，请检查网络或稍后重试'
    ElMessage.error('PDF 加载失败')
    loading.value = false
  }
})

onUnmounted(() => {
  if (progressTimer) {
    clearTimeout(progressTimer)
  }
  if (containerRef.value) {
    containerRef.value.removeEventListener('scroll', handleScroll)
  }

  if (materialId.value && startTime.value) {
    const idStr = String(materialId.value)
    if (idStr.startsWith('demo-') || isNaN(Number(idStr))) {
      return
    }

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
  padding: 0;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 70px);
}

.toolbar-card {
  margin-bottom: 24px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.toolbar-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.page-info {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  padding: 8px 16px;
  background: linear-gradient(135deg, #f0f7ff 0%, #e8f4ff 100%);
  border-radius: 8px;
  border: 1px solid #b3d8ff;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pdf-content-card {
  flex: 1;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  min-height: 600px;
}

.loading-container,
.error-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 500px;
  padding: 60px;
}

.pdf-container {
  padding: 32px;
  overflow-y: auto;
  background: #f5f5f5;
  min-height: 500px;
  max-height: calc(100vh - 300px);
}

.pdf-container canvas {
  max-width: 100%;
  width: 100% !important;
  display: block !important;
  margin: 0 auto 16px auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1) !important;
  background: #fff !important;
  border: 1px solid #e0e0e0 !important;
  border-radius: 8px !important;
  box-sizing: border-box;
  opacity: 1 !important;
  visibility: visible !important;
}

:deep(.el-button-group .el-button) {
  border-radius: 8px;
}
</style>

