<template>
  <div class="desktop-certificate">
    <div class="page-header">
      <div class="header-left">
        <div class="header-icon">
          <el-icon><Medal /></el-icon>
        </div>
        <div class="header-info">
          <h1>合格证书</h1>
          <p>查看和下载您的实验室安全合格证书</p>
        </div>
      </div>
    </div>

    <div v-if="certificates.length > 0" class="cert-section">
      <div class="section-title">我的证书</div>
      <div class="cert-list">
        <div v-for="cert in certificates" :key="cert.id" class="cert-card" @click="viewCertificate(cert)">
          <div class="cert-header">
            <div class="cert-icon">
              <el-icon><Trophy /></el-icon>
            </div>
            <el-tag :type="getGradeLevel(cert.score).tag" size="small">
              {{ getGradeLevel(cert.score).level }}
            </el-tag>
          </div>

          <div class="cert-title">实验室安全教育考试合格证书</div>
          <div class="cert-exam">{{ cert.examName }}</div>

          <div class="cert-info">
            <div class="info-row">
              <span class="info-label">考试成绩</span>
              <span class="info-value score">{{ cert.score }}分</span>
            </div>
            <div class="info-row">
              <span class="info-label">证书编号</span>
              <span class="info-value">{{ cert.certificateNo }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">发证日期</span>
              <span class="info-value">{{ cert.issueDate }}</span>
            </div>
          </div>

          <div class="cert-actions">
            <el-button type="primary" size="small" @click.stop="viewCertificate(cert)">
              查看证书
            </el-button>
            <el-button size="small" @click.stop="viewCertificate(cert)">
              下载证书
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <el-empty v-else description="暂无合格证书">
      <el-button type="primary" @click="router.push('/exam-center')">去参加考试</el-button>
    </el-empty>

    <el-dialog v-model="showPreview" title="证书预览" width="900px" :close-on-click-modal="false">
      <div class="cert-preview-content">
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

      <template #footer>
        <el-button @click="showPreview = false">取消</el-button>
        <el-button type="primary" @click="saveCertificate" :loading="isDownloading">保存高清证书</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElLoading } from 'element-plus'
import { Trophy, Medal } from '@element-plus/icons-vue'
// @ts-ignore
import certBgImage from '@/assets/zhengshu.jpg'
import { getMyCertificates } from '@/api/exam'
import { request } from '@/api/request'

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

const getGradeLevel = (score: number) => {
  if (score >= 90) return { level: '优秀', tag: 'warning' }
  if (score >= 80) return { level: '良好', tag: 'success' }
  return { level: '及格', tag: 'primary' }
}

const certificates = ref<Certificate[]>([])
const selectedCert = ref<Certificate | null>(null)
const showPreview = ref(false)
const certRef = ref<HTMLElement | null>(null)
const isDownloading = ref(false)
const issuerName = ref('中国科学院大学生命科学学院')

const selectedGrade = computed(() => selectedCert.value ? getGradeLevel(selectedCert.value.score) : null)

const viewCertificate = (cert: Certificate) => {
  selectedCert.value = cert
  showPreview.value = true
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

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

const saveCertificate = async () => {
  if (isDownloading.value) return

  isDownloading.value = true
  const loadingInstance = ElLoading.service({ text: '生成高清PDF中...', fullscreen: true })

  try {
    await nextTick()
    await waitForCertificateAssets()
    await delay(120)

    if (!certRef.value) throw new Error('证书元素未找到')

    const [html2canvasModule, jspdfModule] = await Promise.all([
      import('html2canvas'),
      import('jspdf')
    ])
    const html2canvas = html2canvasModule.default
    const jsPDF = jspdfModule.jsPDF

    const canvas = await html2canvas(certRef.value, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 15000,
      removeContainer: true
    })

    const imgData = canvas.toDataURL('image/png', 1.0)
    const pdf = new jsPDF('l', 'mm', 'a4')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    const ratio = Math.min((pdfWidth - 20) / canvas.width, (pdfHeight - 20) / canvas.height)
    const imgX = (pdfWidth - canvas.width * ratio) / 2
    const imgY = (pdfHeight - canvas.height * ratio) / 2

    pdf.addImage(imgData, 'PNG', imgX, imgY, canvas.width * ratio, canvas.height * ratio)
    pdf.save(`实验室安全教育考试合格证书_${selectedCert.value?.studentName || '证书'}.pdf`)

    ElMessage.success('高清证书PDF已下载')
  } catch (error) {
    console.error('桌面端证书生成失败:', error)
    ElMessage.error('生成失败，请重试')
  } finally {
    loadingInstance.close()
    isDownloading.value = false
  }
}

onMounted(async () => {
  try {
    try {
      const settingsResp: any = await request.get('/user/contact')
      const settingsData = settingsResp?.data || settingsResp
      if (settingsData?.cert?.issuer) issuerName.value = settingsData.cert.issuer
    } catch {}

    const resp: any = await getMyCertificates()
    const data = resp?.data ?? resp
    certificates.value = (data || []) as Certificate[]
  } catch (err: any) {
    ElMessage.error(err?.message || '加载证书列表失败')
  }
})
</script>

<style scoped>
.desktop-certificate {
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  width: 48px;
  height: 48px;
  background: #e6a23c;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-icon .el-icon {
  font-size: 24px;
  color: #fff;
}

.header-info h1 {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 4px 0;
}

.header-info p {
  font-size: 13px;
  color: #909399;
  margin: 0;
}

.cert-section {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
}

.cert-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.cert-card {
  padding: 20px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cert-card:hover {
  border-color: #e6a23c;
  box-shadow: 0 4px 12px rgba(230, 162, 60, 0.15);
}

.cert-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.cert-icon {
  width: 40px;
  height: 40px;
  background: #fdf6ec;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cert-icon .el-icon {
  font-size: 20px;
  color: #e6a23c;
}

.cert-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.cert-exam {
  font-size: 13px;
  color: #606266;
  margin-bottom: 16px;
}

.cert-info {
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-label {
  font-size: 13px;
  color: #909399;
}

.info-value {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.info-value.score {
  color: #e6a23c;
  font-size: 16px;
  font-weight: 600;
}

.cert-actions {
  display: flex;
  gap: 8px;
}

.cert-actions .el-button {
  flex: 1;
}

.cert-preview-content {
  padding: 18px;
  background: #e8e0c8;
  display: flex;
  justify-content: center;
}

/* 与移动端保持同一套证书比例和视觉层级。 */
.honor-cert {
  width: 800px;
  height: 562px;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-position: center;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
  text-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
}

.honor-content {
  position: absolute;
  top: 21%;
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
  font-size: 34px;
  line-height: 1.12;
  color: #b92722;
  font-weight: 700;
  letter-spacing: 10px;
  margin: 7px 0 0 0;
  font-family: "STZhongsong", "华文中宋", "Songti SC", "STSong", "SimSun", "宋体", serif;
}

.honor-serial {
  width: 100%;
  align-self: stretch;
  text-align: center;
  padding: 0;
  font-size: 10px;
  line-height: 1.15;
  font-weight: 600;
  letter-spacing: 0.005em;
  color: #514b43;
  margin: 34px 0 7px 0;
  white-space: nowrap;
  font-family: "Times New Roman", "Songti SC", "STSong", "SimSun", serif;
}

.honor-body {
  flex: 1;
  display: flex;
  align-items: center;
  min-height: 0;
  padding: 0 0 28px 0;
  transform: translateY(-12px);
}

.honor-text {
  width: 100%;
  font-size: 18px;
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
  padding: 0 2px 1px;
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

.honor-sign {
  position: absolute;
  right: 7px;
  bottom: 10px;
  min-width: 31%;
  text-align: center;
  color: #3c372f;
}

.honor-org {
  font-size: 13px;
  line-height: 1.3;
  font-weight: 500;
  margin: 0 0 3px 0;
  white-space: nowrap;
  font-family: "Songti SC", "STSong", "SimSun", "宋体", serif;
}

.honor-date {
  font-size: 12px;
  line-height: 1.25;
  font-weight: 500;
  margin: 0;
  white-space: nowrap;
  font-family: "Times New Roman", "Songti SC", "STSong", "SimSun", serif;
}
</style>
