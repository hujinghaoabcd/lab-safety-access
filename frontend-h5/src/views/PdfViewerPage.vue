<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
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
const scale = ref(1.2)
const materialId = ref<string | number | null>(null)
const startTime = ref<number | null>(null) // 学习开始时间

// 配置 pdf.js 的 worker
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker

// 防抖保存进度
let progressTimer: ReturnType<typeof setTimeout> | null = null
const saveProgress = async (page: number, total: number) => {
  if (!materialId.value) return
  
  // 如果是示例数据（字符串 ID），不保存进度
  const idStr = String(materialId.value)
  if (idStr.startsWith('demo-') || isNaN(Number(idStr))) {
    console.log('示例数据，跳过保存进度')
    return
  }
  
  const progress = Math.floor((page / total) * 100)
  
  // 清除之前的定时器
  if (progressTimer) {
    clearTimeout(progressTimer)
  }
  
  // 延迟保存，避免频繁请求
  progressTimer = setTimeout(async () => {
    try {
      await recordProgress(idStr, progress)
    } catch (err) {
      console.error('保存学习进度失败:', err)
    }
  }, 2000) // 2秒后保存
}

// 滚动监听，更新当前页和进度
const handleScroll = () => {
  if (!containerRef.value || totalPages.value === 0) return
  
  const container = containerRef.value
  const scrollTop = container.scrollTop
  const scrollHeight = container.scrollHeight
  const clientHeight = container.clientHeight
  
  // 计算当前页（简化计算，假设每页高度相近）
  const scrollProgress = scrollTop / (scrollHeight - clientHeight)
  const estimatedPage = Math.max(1, Math.min(totalPages.value, Math.ceil(scrollProgress * totalPages.value)))
  
  if (estimatedPage !== currentPage.value) {
    currentPage.value = estimatedPage
    saveProgress(currentPage.value, totalPages.value)
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
    // 记录学习开始时间
    startTime.value = Date.now()
  }

  const originalPdfUrl = decodeURIComponent(encoded)
  console.log('原始 PDF URL:', originalPdfUrl)
  
  // 判断是否是外部 URL，如果是则使用代理
  let pdfUrl = originalPdfUrl
  try {
    const url = new URL(originalPdfUrl)
    // 如果是外部 URL（不是同源的），使用代理
    if (url.origin !== window.location.origin) {
      pdfUrl = getPdfProxyUrl(originalPdfUrl)
      console.log('使用代理 URL:', pdfUrl)
    } else {
      console.log('使用原始 URL（同源）:', pdfUrl)
    }
  } catch (err) {
    // URL 解析失败，可能是相对路径，直接使用
    console.log('URL 解析失败，使用原始 URL:', pdfUrl)
  }

  console.log('最终 PDF URL:', pdfUrl)
  
  try {
    console.log('开始加载 PDF...')
    const pdf = await (pdfjsLib as any).getDocument({
      url: pdfUrl,
      httpHeaders: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }).promise
    console.log('PDF 加载成功，总页数:', pdf.numPages)
    totalPages.value = pdf.numPages
    
    // 先设置 loading 为 false，让容器元素渲染出来
    loading.value = false
    
    // 等待 DOM 更新完成
    await nextTick()
    await nextTick() // 双重确保
    
    // 再次尝试获取容器
    let container = containerRef.value
    if (!container) {
      console.log('容器元素不存在，等待 DOM 更新...')
      // 等待更长时间确保 DOM 渲染完成
      await new Promise(resolve => setTimeout(resolve, 200))
      container = containerRef.value
    }
    
    if (!container) {
      console.error('容器元素仍然不存在，尝试查找...')
      // 尝试通过选择器查找
      container = document.querySelector('.pdf-container') as HTMLDivElement
    }
    
    if (!container) {
      console.error('无法找到容器元素')
      errorMsg.value = '无法找到渲染容器，请刷新页面重试'
      return
    }
    
    console.log('找到容器元素:', container, {
      clientWidth: container.clientWidth,
      offsetWidth: container.offsetWidth
    })

    console.log('容器信息:', {
      clientWidth: container.clientWidth,
      scrollWidth: container.scrollWidth,
      offsetWidth: container.offsetWidth,
      windowWidth: window.innerWidth
    })

    // 添加滚动监听
    container.addEventListener('scroll', handleScroll)

    // 渲染所有页面
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      try {
        console.log(`开始渲染第 ${pageNumber} 页...`)
        const page = await pdf.getPage(pageNumber)
        const viewport = page.getViewport({ scale: scale.value })
        console.log(`页面 ${pageNumber} viewport:`, viewport.width, 'x', viewport.height)
        
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        
        if (!context) {
          console.error(`页面 ${pageNumber} 无法获取 canvas context`)
          continue
        }
        
        // 设置 canvas 尺寸（实际渲染尺寸）
        canvas.width = viewport.width
        canvas.height = viewport.height
        console.log(`Canvas 尺寸设置为: ${canvas.width}x${canvas.height}`)
        
        // 渲染页面
        console.log(`开始渲染页面 ${pageNumber} 到 canvas...`)
        await page
          .render({
            canvasContext: context,
            viewport
          })
          .promise
        console.log(`页面 ${pageNumber} 渲染完成`)

        // 设置 canvas 样式，保持宽高比
        const containerWidth = container.clientWidth || window.innerWidth - 24
        const aspectRatio = viewport.width / viewport.height
        const displayHeight = Math.max(100, containerWidth / aspectRatio) // 确保最小高度
        
        console.log(`页面 ${pageNumber} 样式计算:`, {
          containerWidth,
          aspectRatio,
          displayHeight
        })
        
        canvas.style.width = '100%'
        canvas.style.height = `${displayHeight}px`
        canvas.style.display = 'block'
        canvas.style.marginBottom = '12px'
        canvas.style.maxWidth = '100%'
        canvas.style.backgroundColor = '#fff'
        canvas.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
        canvas.style.border = '1px solid #e0e0e0'
        canvas.setAttribute('data-page', String(pageNumber))
        
        // 验证 canvas 是否有内容
        const imageData = context.getImageData(0, 0, Math.min(100, canvas.width), Math.min(100, canvas.height))
        const hasContent = Array.from(imageData.data).some((val, idx) => {
          const alpha = idx % 4 === 3
          return alpha && val > 0
        })
        console.log(`页面 ${pageNumber} 内容检查:`, { hasContent, imageDataLength: imageData.data.length })
        
        container.appendChild(canvas)
        console.log(`页面 ${pageNumber} 已添加到 DOM`, {
          原始尺寸: `${canvas.width}x${canvas.height}`,
          显示尺寸: `${canvas.style.width}x${canvas.style.height}`,
          viewport: `${viewport.width}x${viewport.height}`,
          scale: scale.value,
          hasContent,
          parentElement: canvas.parentElement?.tagName
        })
      } catch (pageErr) {
        console.error(`页面 ${pageNumber} 渲染失败:`, pageErr)
      }
    }
    
    // 渲染完成后检查
    setTimeout(() => {
      const canvases = container.querySelectorAll('canvas')
      console.log('渲染完成检查:', {
        canvas数量: canvases.length,
        container子元素: container.children.length,
        container高度: container.scrollHeight
      })
      canvases.forEach((canvas, idx) => {
        console.log(`Canvas ${idx + 1}:`, {
          width: canvas.width,
          height: canvas.height,
          styleWidth: canvas.style.width,
          styleHeight: canvas.style.height,
          offsetWidth: canvas.offsetWidth,
          offsetHeight: canvas.offsetHeight,
          display: window.getComputedStyle(canvas).display,
          visibility: window.getComputedStyle(canvas).visibility
        })
      })
    }, 1000)
    
    // 初始化进度
    if (materialId.value) {
      saveProgress(1, totalPages.value)
    }
  } catch (err) {
    console.error('加载 PDF 失败:', err)
    errorMsg.value = 'PDF 加载失败，请检查网络或稍后重试'
    showToast('PDF 加载失败')
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
  
  // 记录学习时长
  if (materialId.value && startTime.value) {
    const idStr = String(materialId.value)
    // 如果是示例数据（字符串 ID），不保存学习时长
    if (idStr.startsWith('demo-') || isNaN(Number(idStr))) {
      console.log('示例数据，跳过保存学习时长')
      return
    }
    
    const studyDuration = Math.floor((Date.now() - startTime.value) / 1000) // 秒
    if (studyDuration > 0) {
      // 异步保存学习时长，不阻塞页面跳转
      recordStudyTime(idStr, studyDuration).catch(err => {
        console.error('保存学习时长失败:', err)
      })
    }
  }
})

// 缩放功能
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
  
  // 判断是否是外部 URL，如果是则使用代理
  let pdfUrl = originalPdfUrl
  try {
    const url = new URL(originalPdfUrl)
    // 如果是外部 URL（不是同源的），使用代理
    if (url.origin !== window.location.origin) {
      pdfUrl = getPdfProxyUrl(originalPdfUrl)
    }
  } catch (err) {
    // URL 解析失败，可能是相对路径，直接使用
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
        
        // 设置 canvas 尺寸
        canvas.width = viewport.width
        canvas.height = viewport.height
        
        // 渲染页面
        await page
          .render({
            canvasContext: context,
            viewport
          })
          .promise

        // 设置 canvas 样式，保持宽高比
        const containerWidth = container.clientWidth || window.innerWidth - 24
        const aspectRatio = viewport.width / viewport.height
        const displayHeight = containerWidth / aspectRatio
        
        canvas.style.width = '100%'
        canvas.style.height = `${displayHeight}px`
        canvas.style.display = 'block'
        canvas.style.marginBottom = '12px'
        canvas.style.maxWidth = '100%'
        canvas.style.backgroundColor = '#fff'
        canvas.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
        canvas.style.border = '1px solid #e0e0e0'
        canvas.setAttribute('data-page', String(pageNumber))
        container.appendChild(canvas)
        
        console.log(`页面 ${pageNumber} 重新渲染完成`, {
          原始尺寸: `${canvas.width}x${canvas.height}`,
          显示尺寸: `${canvas.style.width}x${canvas.style.height}`,
          viewport: `${viewport.width}x${viewport.height}`,
          scale: scale.value
        })
      } catch (pageErr) {
        console.error(`页面 ${pageNumber} 渲染失败:`, pageErr)
      }
    }
  } catch (err) {
    console.error('重新加载 PDF 失败:', err)
    showToast('重新加载失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="pdf-viewer-page">
    <van-nav-bar class="blue-nav" title="PDF 预览" left-arrow @click-left="router.back()">
      <template #right>
        <div class="nav-actions">
          <van-icon name="minus" @click="zoomOut" />
          <span class="scale-text">{{ Math.round(scale * 100) }}%</span>
          <van-icon name="plus" @click="zoomIn" />
        </div>
      </template>
    </van-nav-bar>

    <div class="tip" v-if="totalPages > 0">
      <div class="page-info">
        第 {{ currentPage }} / {{ totalPages }} 页
      </div>
    </div>

    <div v-if="loading" class="loading">
      <van-loading size="24px">PDF 加载中...</van-loading>
    </div>

    <div v-else-if="errorMsg" class="error">
      <van-empty :description="errorMsg" />
    </div>

    <div v-else>
      <div ref="containerRef" class="pdf-container" />
    </div>
  </div>
</template>

<style scoped>
.pdf-viewer-page {
  min-height: 100vh;
  background: #f7f8fa;
  display: flex;
  flex-direction: column;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-right: 8px;
}

.nav-actions .van-icon {
  font-size: 18px;
  color: #fff;
  cursor: pointer;
  padding: 4px;
}

.scale-text {
  font-size: 14px;
  color: #fff;
  min-width: 50px;
  text-align: center;
}

.tip {
  padding: 8px 12px;
  background: #fffbe8;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.page-info {
  font-size: 3.2vw;
  color: #0475FA;
  font-weight: 500;
  white-space: nowrap;
}

.loading,
.error {
  padding: 40px 16px;
  text-align: center;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pdf-container {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: #f5f5f5;
}

.pdf-container {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: #f5f5f5;
  min-height: 200px;
  width: 100%;
  box-sizing: border-box;
}

.pdf-container canvas {
  max-width: 100%;
  width: 100% !important;
  display: block !important;
  margin: 0 auto 12px auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background: #fff !important;
  border: 1px solid #e0e0e0;
  box-sizing: border-box;
  /* 确保 canvas 可见 */
  opacity: 1 !important;
  visibility: visible !important;
}
</style>



