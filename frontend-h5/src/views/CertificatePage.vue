<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showLoadingToast, closeToast } from 'vant'
import certBgImage from '@/assets/zhengshu.jpg'
import { getMyCertificates } from '../api/exam'
import { request } from '../api/request'

const router = useRouter()

interface Certificate {
  id: string | number
  examName: string
  examDate: string
  score: number
  issueDate: string
  certificateNo: string
  studentName: string
  studentId: string
  department: string
}

type CertificateTagType = 'primary' | 'success' | 'warning'

interface GradeLevel {
  level: string
  color: string
  tag: CertificateTagType
}

const getGradeLevel = (score: number): GradeLevel => {
  if (score >= 90) return { level: '优秀', color: '#FFD700', tag: 'warning' }
  if (score >= 80) return { level: '良好', color: '#07c160', tag: 'success' }
  return { level: '及格', color: '#0475FA', tag: 'primary' }
}

const certificates = ref<Certificate[]>([])
const selectedCert = ref<Certificate | null>(null)
const showPreview = ref(false)
const certRef = ref<HTMLElement | null>(null)
const isDownloading = ref(false)
const showImagePreview = ref(false)
const generatedImageUrl = ref('')
const issuerName = ref('中国科学院大学生命科学学院')

const selectedGrade = computed(() => {
  if (!selectedCert.value) return null
  return getGradeLevel(selectedCert.value.score)
})

const viewCertificate = (cert: Certificate) => {
  selectedCert.value = cert
  showPreview.value = true
}

onMounted(async () => {
  try {
    try {
      const settingsResp: any = await request.get('/user/contact')
      const settingsData = settingsResp?.data || settingsResp
      if (settingsData?.cert?.issuer) {
        issuerName.value = settingsData.cert.issuer
      }
    } catch (err) {
      console.warn('加载发证单位设置失败，使用默认值:', err)
    }

    const resp: any = await getMyCertificates()
    const data = resp?.data ?? resp
    certificates.value = (data || []) as Certificate[]
  } catch (err: any) {
    console.error('[Certificate] getMyCertificates error:', err)
    showToast(err?.message || '加载证书列表失败')
  }
})

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const isWechat = () => {
  const ua = navigator.userAgent.toLowerCase()
  return ua.includes('micromessenger')
}

// 移动端证书本身只有数百 CSS 像素宽，导出时提高渲染倍率，
// 避免直接按屏幕尺寸截图造成文字和边框发虚。
const getCertificateRenderScale = () => {
  const deviceScale = Number(window.devicePixelRatio || 1)
  return Math.min(5, Math.max(4, deviceScale * 1.5))
}

const waitForCertificateAssets = async () => {
  try {
    const fonts = (document as any).fonts
    if (fonts?.ready) await fonts.ready
  } catch {}

  await new Promise<void>((resolve) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => resolve()
    image.src = certBgImage
    if (image.complete) resolve()
  })
}

const renderCertificateCanvas = async () => {
  await nextTick()
  await waitForCertificateAssets()
  await delay(120)

  if (!certRef.value) {
    throw new Error('证书元素未找到')
  }

  const html2canvasModule = await import('html2canvas')
  const html2canvas = html2canvasModule.default

  return html2canvas(certRef.value, {
    scale: getCertificateRenderScale(),
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 15000,
    removeContainer: true,
    windowWidth: document.documentElement.clientWidth,
    windowHeight: document.documentElement.clientHeight
  })
}

const generateImage = async () => {
  if (isDownloading.value) return

  isDownloading.value = true
  showLoadingToast({ message: '生成高清证书中...', forbidClick: true, duration: 0 })

  try {
    const canvas = await renderCertificateCanvas()
    generatedImageUrl.value = canvas.toDataURL('image/png', 1.0)
    closeToast()

    if (isWechat()) {
      showPreview.value = false
      await nextTick()
      showImagePreview.value = true
    } else {
      const link = document.createElement('a')
      link.download = `实验室安全教育考试合格证书_${selectedCert.value?.studentName || '证书'}.png`
      link.href = generatedImageUrl.value
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showToast({ message: '高清证书图片已下载', type: 'success' })
    }
  } catch (error) {
    closeToast()
    showToast({ message: '生成失败，请重试', type: 'fail' })
    console.error('图片生成失败:', error)
  } finally {
    isDownloading.value = false
  }
}

const saveCertificate = async () => {
  if (isWechat()) {
    await generateImage()
    return
  }

  if (isDownloading.value) return

  isDownloading.value = true
  showLoadingToast({ message: '生成高清PDF中...', forbidClick: true, duration: 0 })

  try {
    const [canvas, jspdfModule] = await Promise.all([
      renderCertificateCanvas(),
      import('jspdf')
    ])
    const jsPDF = jspdfModule.jsPDF
    const imgData = canvas.toDataURL('image/png', 1.0)
    const pdf = new jsPDF('l', 'mm', 'a4')

    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = canvas.width
    const imgHeight = canvas.height
    const ratio = Math.min((pdfWidth - 20) / imgWidth, (pdfHeight - 20) / imgHeight)
    const imgX = (pdfWidth - imgWidth * ratio) / 2
    const imgY = (pdfHeight - imgHeight * ratio) / 2

    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio)
    pdf.save(`实验室安全教育考试合格证书_${selectedCert.value?.studentName || '证书'}.pdf`)

    closeToast()
    showToast({ message: '高清证书PDF已下载', type: 'success' })
  } catch (error) {
    closeToast()
    console.error('PDF生成失败:', error)
    isDownloading.value = false
    await generateImage()
  } finally {
    isDownloading.value = false
  }
}
</script>

<template>
  <div class="certificate-page">
    <van-nav-bar class="blue-nav" title="合格证书" left-arrow @click-left="router.back()" />

    <div class="content">
      <div v-if="certificates.length > 0" class="cert-list">
        <div v-for="cert in certificates" :key="cert.id" class="cert-card" @click="viewCertificate(cert)">
          <div class="cert-header">
            <div class="cert-icon">🏆</div>
            <van-tag :type="getGradeLevel(cert.score).tag">
              {{ getGradeLevel(cert.score).level }}
            </van-tag>
          </div>

          <h3 class="card-title">实验室安全教育考试合格证书</h3>
          <p class="card-exam">{{ cert.examName }}</p>

          <div class="cert-info">
            <div class="info-item">
              <span class="label">考试成绩</span>
              <span class="value score">{{ cert.score }}分</span>
            </div>
            <div class="info-item">
              <span class="label">证书编号</span>
              <span class="value">{{ cert.certificateNo }}</span>
            </div>
            <div class="info-item">
              <span class="label">发证日期</span>
              <span class="value">{{ cert.issueDate }}</span>
            </div>
          </div>

          <div class="cert-actions">
            <van-button size="small" plain type="primary" @click.stop="viewCertificate(cert)">
              查看证书
            </van-button>
            <van-button size="small" type="primary" @click.stop="viewCertificate(cert)">
              下载证书
            </van-button>
          </div>
        </div>
      </div>

      <van-empty v-else description="暂无合格证书">
        <van-button type="primary" @click="router.push('/exam-center')">
          去参加考试
        </van-button>
      </van-empty>
    </div>

    <van-popup
      :show="showPreview"
      @update:show="val => (showPreview = val)"
      position="bottom"
      :style="{ height: '100%', background: '#e8e0c8' }"
      closeable
      close-icon-position="top-left"
    >
      <div class="cert-popup-wrapper">
        <div class="cert-popup-content">
          <div
            v-if="selectedCert"
            ref="certRef"
            class="honor-cert"
            :style="{ backgroundImage: `url(${certBgImage})` }"
          >
            <div class="honor-content">
              <h1 class="honor-title">荣 誉 证 书</h1>
              <p class="honor-serial">编号：{{ selectedCert.certificateNo }}</p>

              <div class="honor-body">
                <p class="honor-text">
                  <span class="honor-name">{{ selectedCert.studentName }}</span>
                  同学于{{ selectedCert.examDate }}参加“{{ selectedCert.examName }}”考试，考试成绩为：<span class="honor-score">{{ selectedCert.score }}分</span>，考试结果为：<span class="honor-grade">{{ selectedGrade?.level }}</span>！
                </p>
              </div>

              <div class="honor-sign">
                <p class="honor-org">{{ issuerName }}</p>
                <p class="honor-date">{{ selectedCert.issueDate }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="cert-popup-footer">
          <van-button type="primary" block @click="saveCertificate" :loading="isDownloading">
            <van-icon name="down" /> 保存高清证书
          </van-button>
        </div>
      </div>
    </van-popup>

    <van-popup
      :show="showImagePreview"
      @update:show="val => (showImagePreview = val)"
      position="center"
      :style="{ width: '95%', maxHeight: '95vh', background: 'transparent' }"
      closeable
      close-icon-position="top-right"
    >
      <div class="image-preview-container">
        <div class="preview-tip">长按高清图片保存到相册</div>
        <img v-if="generatedImageUrl" :src="generatedImageUrl" class="preview-image" alt="证书" />
        <van-button type="primary" block @click="showImagePreview = false" style="margin-top: 3vw;">
          关闭
        </van-button>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.certificate-page {
  min-height: 100vh;
  background: #f7f8fa;
}

.content {
  padding: 4vw;
}

.cert-list {
  display: flex;
  flex-direction: column;
  gap: 4vw;
}

.cert-card {
  background: linear-gradient(135deg, #fffdf5 0%, #fff 50%);
  padding: 5vw;
  border: 2px solid #e8d48b;
  position: relative;
  overflow: hidden;
}

.cert-card::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 20vw;
  height: 20vw;
  background: linear-gradient(135deg, transparent 50%, rgba(232, 212, 139, 0.2) 50%);
}

.cert-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3vw;
}

.cert-icon {
  font-size: 8vw;
}

.card-title {
  font-size: 4.5vw;
  font-weight: 600;
  color: #323233;
  margin-bottom: 1.5vw;
}

.card-exam {
  font-size: 3.5vw;
  color: #646566;
  margin-bottom: 4vw;
}

.cert-info {
  background: rgba(232, 212, 139, 0.15);
  padding: 3vw;
  margin-bottom: 4vw;
}

.info-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2vw;
  font-size: 3.4vw;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-item .label {
  color: #969799;
}

.info-item .value {
  color: #323233;
  font-weight: 500;
}

.info-item .value.score {
  color: #0475FA;
  font-weight: 700;
}

.cert-actions {
  display: flex;
  gap: 3vw;
}

.cert-actions .van-button {
  flex: 1;
}

.cert-popup-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.cert-popup-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 15vw 2vw 2vw;
  overflow: auto;
}

.cert-popup-footer {
  padding: 3vw 4vw;
  background: #fff;
  border-top: 1px solid #eee;
}

.cert-popup-footer .van-button {
  font-size: 4vw;
}

/* 横版证书：按照常见纸质荣誉证书的视觉层级布置标题、编号、正文和落款。 */
.honor-cert {
  width: 94vw;
  height: 66vw;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-position: center;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
  text-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
  transform: translateZ(0);
}

.honor-content {
  position: absolute;
  top: 19.5%;
  left: 17%;
  right: 17%;
  bottom: 22%;
  display: flex;
  flex-direction: column;
  color: #28241f;
  font-family: "Songti SC", "STSong", "SimSun", "宋体", "Noto Serif CJK SC", "Noto Serif SC", serif;
}

.honor-title {
  text-align: center;
  font-size: clamp(15px, 3.8vw, 28px);
  line-height: 1.12;
  color: #b92722;
  font-weight: 700;
  letter-spacing: 1.12vw;
  margin: 0.8vw 0 0 0;
  font-family: "STZhongsong", "华文中宋", "Songti SC", "STSong", "SimSun", "宋体", serif;
}

/* 真正纸质证书中编号通常是标题下方的弱层级辅助信息：字号更小、留出呼吸空间并靠右。 */
.honor-serial {
  width: 92%;
  align-self: flex-end;
  box-sizing: border-box;
  text-align: right;
  padding-right: 0.6vw;
  font-size: clamp(6px, 0.78vw, 8px);
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: #514b43;
  margin: 1.55vw 0 1.05vw 0;
  white-space: nowrap;
  font-family: "Times New Roman", "Songti SC", "STSong", "SimSun", serif;
}

.honor-body {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 0 3.2vw 0;
  min-height: 0;
}

.honor-text {
  width: 100%;
  font-size: clamp(10px, 2.02vw, 16px);
  color: #27231f;
  line-height: 1.9;
  letter-spacing: 0.012em;
  text-indent: 2em;
  margin: 0;
  font-weight: 400;
  font-family: "Songti SC", "STSong", "SimSun", "宋体", "Noto Serif CJK SC", serif;
}

.honor-name {
  font-size: inherit;
  font-weight: 700;
  color: #171411;
  border-bottom: 1px solid #5e574d;
  padding: 0 0.15em 0.08em;
  font-family: "Kaiti SC", "STKaiti", "KaiTi", "楷体", serif;
}

.honor-score {
  font-weight: 700;
  color: #171411;
}

.honor-grade {
  font-weight: 700;
  color: #b92722;
}

/* 落款与日期整体向上收，和下边框保持明显留白。 */
.honor-sign {
  position: absolute;
  right: 0.8vw;
  bottom: 1.2vw;
  min-width: 31%;
  text-align: center;
  color: #3c372f;
}

.honor-org {
  font-size: clamp(8px, 1.48vw, 12px);
  line-height: 1.3;
  font-weight: 500;
  margin: 0 0 0.34vw 0;
  white-space: nowrap;
  font-family: "Songti SC", "STSong", "SimSun", "宋体", serif;
}

.honor-date {
  font-size: clamp(8px, 1.38vw, 11px);
  line-height: 1.25;
  font-weight: 500;
  margin: 0;
  white-space: nowrap;
  font-family: "Times New Roman", "Songti SC", "STSong", "SimSun", serif;
}

.image-preview-container {
  background: #fff;
  padding: 4vw;
  text-align: center;
}

.preview-tip {
  background: #0475FA;
  color: #fff;
  padding: 3vw;
  font-size: 4vw;
  margin-bottom: 3vw;
}

.preview-image {
  width: 100%;
  max-height: 70vh;
  object-fit: contain;
  display: block;
  image-rendering: auto;
}
</style>
