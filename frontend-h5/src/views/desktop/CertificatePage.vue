<template>
  <div class="desktop-certificate">
    <section class="certificate-panel">
      <template v-if="certificates.length > 0">
        <div class="panel-toolbar">
          <div class="panel-title">证书列表</div>
          <div class="certificate-count">共 {{ certificates.length }} 张</div>
        </div>

        <div class="table-head">
          <div>证书信息</div>
          <div>考试成绩</div>
          <div>等级</div>
          <div>发证日期</div>
          <div>操作</div>
        </div>

        <div class="certificate-list">
          <div
            v-for="cert in pagedCertificates"
            :key="cert.id"
            class="certificate-row"
          >
            <div class="certificate-main">
              <div class="cert-mark"><el-icon><Medal /></el-icon></div>
              <div class="certificate-copy">
                <div class="certificate-title">实验室安全教育考试合格证书</div>
                <div class="certificate-meta">
                  <span class="certificate-exam">{{ cert.examName }}</span>
                  <span class="meta-sep">·</span>
                  <span class="certificate-no">编号：{{ cert.certificateNo }}</span>
                </div>
              </div>
            </div>

            <div class="score-cell">
              <strong>{{ cert.score }}</strong><span>分</span>
            </div>

            <div>
              <el-tag :type="getGradeLevel(cert.score).tag" effect="plain">
                {{ getGradeLevel(cert.score).level }}
              </el-tag>
            </div>

            <div class="date-cell">{{ cert.issueDate }}</div>

            <div class="action-cell">
              <el-button size="small" @click="viewCertificate(cert)">预览</el-button>
              <el-button type="primary" size="small" @click="downloadCertificate(cert)">下载</el-button>
            </div>
          </div>
        </div>

        <div v-if="certificates.length > pageSize" class="pagination-wrap">
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="certificates.length"
            layout="total, prev, pager, next"
            background
          />
        </div>
      </template>

      <div v-else class="empty-wrap">
        <el-empty description="暂无合格证书">
          <el-button type="primary" @click="router.push('/exam-center')">去参加考试</el-button>
        </el-empty>
      </div>
    </section>

    <el-dialog
      class="certificate-dialog"
      v-model="showPreview"
      width="860px"
      :show-close="false"
      :close-on-click-modal="false"
    >
      <template #header="{ close }">
        <div class="dialog-titlebar">
          <div class="dialog-title">证书预览</div>
          <button class="dialog-close" type="button" aria-label="关闭" @click="close">×</button>
        </div>
      </template>

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
        <el-button @click="showPreview = false">关闭</el-button>
        <el-button type="primary" @click="saveCertificate" :loading="isDownloading">保存高清证书</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElLoading } from 'element-plus'
import { Medal } from '@element-plus/icons-vue'
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
const currentPage = ref(1)
const pageSize = 8

const selectedGrade = computed(() => selectedCert.value ? getGradeLevel(selectedCert.value.score) : null)
const pagedCertificates = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return certificates.value.slice(start, start + pageSize)
})

const viewCertificate = (cert: Certificate) => {
  selectedCert.value = cert
  showPreview.value = true
}

const downloadCertificate = async (cert: Certificate) => {
  selectedCert.value = cert
  showPreview.value = true
  await nextTick()
  await saveCertificate()
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
  color: #1f2937;
}

.certificate-panel {
  background: #fff;
  border: 1px solid #e2e7ed;
}

.panel-toolbar {
  min-height: 52px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e5eaf0;
}

.panel-title {
  font-size: 16px;
  font-weight: 700;
  color: #172033;
}

.certificate-count {
  font-size: 13px;
  color: #8a96a8;
}

.table-head,
.certificate-row {
  display: grid;
  grid-template-columns: minmax(460px, 1.9fr) 120px 110px 140px 160px;
  align-items: center;
}

.table-head {
  min-height: 44px;
  padding: 0 20px;
  background: #f6f8fa;
  border-bottom: 1px solid #e2e7ed;
  color: #6f7b8d;
  font-size: 13px;
  font-weight: 600;
}

.certificate-row {
  min-height: 88px;
  padding: 0 20px;
  border-bottom: 1px solid #edf0f4;
}

.certificate-row:last-child {
  border-bottom: none;
}

.certificate-row:hover {
  background: #f8fbff;
}

.certificate-main {
  display: flex;
  align-items: center;
  min-width: 0;
  padding-right: 24px;
}

.cert-mark {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff5dc;
  color: #d79518;
  font-size: 20px;
  margin-right: 14px;
}

.certificate-copy {
  min-width: 0;
}

.certificate-title {
  font-size: 14px;
  font-weight: 700;
  color: #243044;
  margin-bottom: 7px;
}

.certificate-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  color: #8b96a7;
  font-size: 12px;
}

.certificate-exam,
.certificate-no {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.certificate-exam {
  color: #667386;
  max-width: 180px;
}

.certificate-no {
  min-width: 0;
}

.meta-sep {
  color: #c1c8d1;
}

.score-cell {
  color: #0475FA;
}

.score-cell strong {
  font-size: 22px;
  font-weight: 700;
}

.score-cell span {
  margin-left: 3px;
  font-size: 12px;
  color: #8e99aa;
}

.date-cell {
  font-size: 13px;
  color: #5f6b7a;
}

.action-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-cell :deep(.el-button + .el-button) {
  margin-left: 0;
}

.action-cell :deep(.el-button) {
  min-width: 56px;
  height: 34px;
  padding: 0 14px;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  padding: 12px 20px;
  border-top: 1px solid #e2e7ed;
}

.empty-wrap {
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.certificate-dialog.el-dialog) {
  padding: 0 !important;
  border-radius: 0 !important;
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(19, 39, 70, 0.24);
}

:deep(.certificate-dialog .el-dialog__header) {
  margin: 0 !important;
  padding: 0 !important;
}

.dialog-titlebar {
  height: 50px;
  padding: 0 12px 0 18px;
  background: #0475FA;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dialog-title {
  font-size: 17px;
  font-weight: 700;
}

.dialog-close {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  font-size: 25px;
  line-height: 30px;
  cursor: pointer;
}

.dialog-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

:deep(.certificate-dialog .el-dialog__body) {
  padding: 14px !important;
  background: #f3f5f7;
}

:deep(.certificate-dialog .el-dialog__footer) {
  padding: 12px 18px !important;
  background: #fff;
  border-top: none;
}

.cert-preview-content {
  display: flex;
  justify-content: center;
}

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
  font-size: 23px;
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
  font-size: 18px;
  line-height: 1.3;
  font-weight: 500;
  margin: 0 0 3px 0;
  white-space: nowrap;
  font-family: "Songti SC", "STSong", "SimSun", "宋体", serif;
}

.honor-date {
  font-size: 17px;
  line-height: 1.25;
  font-weight: 500;
  margin: 0;
  white-space: nowrap;
  font-family: "Times New Roman", "Songti SC", "STSong", "SimSun", serif;
}

@media (max-width: 1200px) {
  .table-head,
  .certificate-row {
    grid-template-columns: minmax(360px, 1.6fr) 105px 95px 125px 150px;
  }
}
</style>