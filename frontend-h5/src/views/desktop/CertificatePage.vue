<template>
  <div class="desktop-certificate">
    <!-- 页面头部 -->
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

    <!-- 证书列表 -->
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

    <!-- 证书预览对话框 -->
    <el-dialog v-model="showPreview" title="证书预览" width="900px" :close-on-click-modal="false">
      <div class="cert-preview-content">
        <div v-if="selectedCert" ref="certRef" class="honor-cert" :style="{ backgroundImage: `url(${certBgImage})` }">
          <div class="honor-content">
            <h1 class="honor-title">荣 誉 证 书</h1>
            <p class="honor-serial">编号：{{ selectedCert.certificateNo }}</p>
            <div class="honor-body">
              <p class="honor-text">
                <span class="honor-name">{{ selectedCert.studentName }}</span> 同学于{{ selectedCert.examDate }}参加"{{ selectedCert.examName }}"考试，考试成绩为:<span class="honor-score">{{ selectedCert.score }}分</span>,考试结果为:<span class="honor-grade">{{ selectedGrade?.level }}</span>！
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
        <el-button type="primary" @click="saveCertificate" :loading="isDownloading">保存证书</el-button>
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

const saveCertificate = async () => {
  if (isDownloading.value) return

  isDownloading.value = true
  const loadingInstance = ElLoading.service({ text: '生成PDF中...', fullscreen: true })

  try {
    await nextTick()
    await delay(300)

    if (!certRef.value) throw new Error('证书元素未找到')

    const [html2canvasModule, jspdfModule] = await Promise.all([import('html2canvas'), import('jspdf')])
    const html2canvas = html2canvasModule.default
    const jsPDF = jspdfModule.jsPDF

    const canvas = await html2canvas(certRef.value, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('l', 'mm', 'a4')

    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    const ratio = Math.min((pdfWidth - 20) / canvas.width, (pdfHeight - 20) / canvas.height)
    const imgX = (pdfWidth - canvas.width * ratio) / 2
    const imgY = (pdfHeight - canvas.height * ratio) / 2

    pdf.addImage(imgData, 'PNG', imgX, imgY, canvas.width * ratio, canvas.height * ratio)
    pdf.save(`实验室安全教育考试合格证书_${selectedCert.value?.studentName || '证书'}.pdf`)

    ElMessage.success('证书PDF已下载')
    loadingInstance.close()
  } catch (error) {
    ElMessage.error('生成失败，请重试')
    loadingInstance.close()
  } finally {
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

/* 页面头部 */
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

/* 证书列表 */
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

/* 证书预览 */
.cert-preview-content {
  padding: 20px;
  background: #e8e0c8;
  display: flex;
  justify-content: center;
}

.honor-cert {
  width: 800px;
  height: 600px;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.honor-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 80px;
  text-align: center;
}

.honor-title {
  font-size: 48px;
  font-weight: 700;
  color: #8B4513;
  margin: 0 0 20px 0;
  letter-spacing: 8px;
}

.honor-serial {
  font-size: 16px;
  color: #666;
  margin: 0 0 40px 0;
}

.honor-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 40px 0;
}

.honor-text {
  font-size: 20px;
  color: #333;
  line-height: 2;
  margin: 0;
}

.honor-name, .honor-score, .honor-grade {
  font-size: 24px;
  font-weight: 700;
}

.honor-name { color: #8B4513; }
.honor-score { color: #FF6B6B; }
.honor-grade { color: #FFD700; }

.honor-sign {
  margin-top: 40px;
  text-align: right;
  width: 100%;
}

.honor-org {
  font-size: 18px;
  color: #333;
  margin: 0 0 20px 0;
  font-weight: 600;
}

.honor-date {
  font-size: 16px;
  color: #666;
  margin: 0;
}
</style>
