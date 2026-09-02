<template>
  <div class="desktop-certificate">
    <div class="page-heading">
      <div>
        <h1>合格证书</h1>
        <p>查看和下载已获得的实验室安全教育考试合格证书</p>
      </div>
      <div class="certificate-count">共 {{ certificates.length }} 张证书</div>
    </div>

    <section class="certificate-panel">
      <template v-if="certificates.length > 0">
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
                <div class="certificate-exam">{{ cert.examName }}</div>
                <div class="certificate-no">证书编号：{{ cert.certificateNo }}</div>
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
              <el-button type="primary" link @click="viewCertificate(cert)">预览</el-button>
              <el-button link @click="viewCertificate(cert)">下载</el-button>
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

.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 8px 0 20px;
  border-bottom: 1px solid #dfe4ea;
  margin-bottom: 20px;
}

.page-heading h1 {
  margin: 0 0 6px;
  font-size: 26px;
  font-weight: 700;
  color: #172033;
}

.page-heading p {
  margin: 0;
  font-size: 14px;
  color: #8a96a8;
}

.certificate-count {
  font-size: 13px;
  color: #8a96a8;
}

.certificate-panel {
  background: #fff;
  border: 1px solid #e2e7ed;
}

.table-head,
.certificate-row {
  display: grid;
  grid-template-columns: minmax(430px, 1.8fr) 130px 120px 150px 130px;
  align-items: center;
}

.table-head {
  min-height: 48px;
  padding: 0 20px;
  background: #f5f7fa;
  border-bottom: 1px solid #e2e7ed;
  color: #6f7b8d;
  font-size: 13px;
  font-weight: 600;
}

.certificate-row {
  min-height: 112px;
  padding: 0 20px;
  border-bottom: 1px solid #edf0f4;
}

.certificate-row:last-child {
  border-bottom: none;
}

.certificate-row:hover {
  background: #fafcff;
}

.certificate-main {
  display: flex;
  align-items: center;
  min-width: 0;
  padding-right: 24px;
}

.cert-mark {
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5c679;
  background: #fff9e9;
  color: #c98b17;
  font-size: 22px;
  margin-right: 16px;
}

.certificate-copy {
  min-width: 0;
}

.certificate-title {
  font-size: 15px;
  font-weight: 700;
  color: #243044;
  margin-bottom: 7px;
}

.certificate-exam {
  font-size: 13px;
  color: #5f6b7a;
  margin-bottom: 7px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.certificate-no {
  font-size: 12px;
  color: #9aa4b3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid #e2e7ed;
}

.empty-wrap {
  min-height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cert-preview-content {
  padding: 18px;
  background: #e8e0c8;
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

:deep(.el-dialog) {
  border-radius: 0 !important;
}

:deep(.el-dialog__header) {
  margin-right: 0;
  padding: 18px 20px;
  border-bottom: 1px solid #e5eaf0;
}

:deep(.el-dialog__footer) {
  padding: 14px 20px;
  border-top: 1px solid #e5eaf0;
}

@media (max-width: 1200px) {
  .table-head,
  .certificate-row {
    grid-template-columns: minmax(360px, 1.6fr) 110px 100px 130px 110px;
  }
}
</style>
