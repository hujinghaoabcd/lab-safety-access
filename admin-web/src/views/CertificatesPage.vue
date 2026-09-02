<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as adminApi from '@/api/admin'

interface Certificate {
  id: number
  certificateNo: string
  studentId: string
  studentName: string
  department: string
  examName: string
  score: number
  grade: string
  issueDate: string
  status: number
}

const certificates = ref<Certificate[]>([])
const loading = ref(false)

const searchForm = reactive({
  keyword: '',
  examName: '',
  grade: '',
  status: ''
})

const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 0
})

const loadCertificates = async () => {
  loading.value = true
  try {
    const params: any = {
      page: pagination.currentPage,
      pageSize: pagination.pageSize
    }
    if (searchForm.keyword) params.keyword = searchForm.keyword
    if (searchForm.examName) params.examName = searchForm.examName
    if (searchForm.grade) params.grade = searchForm.grade
    if (searchForm.status !== '') params.status = searchForm.status

    const data: any = await adminApi.getCertificates(params)
    const list = Array.isArray(data?.list) ? data.list : []
    certificates.value = list
    pagination.total = data?.total ?? list.length
    if (typeof data?.page === 'number') pagination.currentPage = data.page
    if (typeof data?.pageSize === 'number') pagination.pageSize = data.pageSize
  } catch (err: any) {
    console.error('加载证书列表失败:', err)
    ElMessage.error(err?.message || '加载证书列表失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadCertificates()
})

const handleSearch = () => {
  pagination.currentPage = 1
  loadCertificates()
}

const handleReset = () => {
  searchForm.keyword = ''
  searchForm.examName = ''
  searchForm.grade = ''
  searchForm.status = ''
  pagination.currentPage = 1
  loadCertificates()
}

const handleRevoke = async (row: Certificate) => {
  try {
    await ElMessageBox.confirm(`确定要撤销 ${row.studentName} 的证书吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await adminApi.revokeCertificate(row.id)
    ElMessage.success('证书已撤销')
    loadCertificates()
  } catch (err: any) {
    if (err === 'cancel') return
    console.error('撤销证书失败:', err)
    ElMessage.error(err?.message || '撤销证书失败')
  }
}

const handleReissue = async (row: Certificate) => {
  try {
    await adminApi.reissueCertificate(row.id)
    ElMessage.success('证书已重新发放')
    loadCertificates()
  } catch (err: any) {
    console.error('重新发放证书失败:', err)
    ElMessage.error(err?.message || '重新发放证书失败')
  }
}

const handleExport = async () => {
  try {
    const params: any = {}
    if (searchForm.keyword) params.keyword = searchForm.keyword
    if (searchForm.examName) params.examName = searchForm.examName
    if (searchForm.grade) params.grade = searchForm.grade
    if (searchForm.status !== '') params.status = searchForm.status

    const data: any = await adminApi.exportCertificates(params)
    if (data?.base64) {
      const link = document.createElement('a')
      link.href = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + data.base64
      link.download = data.fileName || '证书导出.xlsx'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      ElMessage.success('导出成功')
    } else {
      ElMessage.warning('导出数据为空')
    }
  } catch (err: any) {
    console.error('导出证书失败:', err)
    ElMessage.error(err?.message || '导出证书失败')
  }
}

const showCertDetail = ref(false)
const currentCert = ref<Certificate | null>(null)

const viewCertificate = (row: Certificate) => {
  currentCert.value = row
  showCertDetail.value = true
}

const getGradeColor = (grade: string) => {
  if (grade === '优秀') return '#FFD700'
  if (grade === '良好') return '#07c160'
  return '#0475FA'
}
const handleCertificatePageChange = (page: number) => {
  pagination.currentPage = page
  loadCertificates()
}

const handleCertificatePageSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.currentPage = 1
  loadCertificates()
}

</script>

<template>
  <div class="certificates-page">
    <div class="page-card">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="证书编号/学号/姓名" clearable style="width: 180px" />
        </el-form-item>
        <el-form-item label="考试名称">
          <el-input v-model="searchForm.examName" placeholder="考试名称" clearable style="width: 160px" />
        </el-form-item>
        <el-form-item label="等级">
          <el-select v-model="searchForm.grade" placeholder="全部" clearable style="width: 100px">
            <el-option label="优秀" value="优秀" />
            <el-option label="良好" value="良好" />
            <el-option label="及格" value="及格" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 100px">
            <el-option label="有效" :value="1" />
            <el-option label="已撤销" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="page-card">
      <div class="page-header">
        <h2>证书列表</h2>
        <el-button type="success" @click="handleExport">
          <el-icon><Download /></el-icon>
          导出数据
        </el-button>
      </div>

      <el-table v-loading="loading" :data="certificates" stripe border>
        <el-table-column prop="certificateNo" label="证书编号" width="200" />
        <el-table-column prop="studentId" label="学号" width="120" />
        <el-table-column prop="studentName" label="姓名" width="100" />
        <el-table-column prop="department" label="院系" width="140" />
        <el-table-column prop="examName" label="考试名称" min-width="180" />
        <el-table-column prop="score" label="分数" width="80">
          <template #default="{ row }">
            <span style="font-weight: bold; color: #0475FA">{{ row.score }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="grade" label="等级" width="80">
          <template #default="{ row }">
            <el-tag 
              :type="row.grade === '优秀' ? 'warning' : row.grade === '良好' ? 'success' : 'primary'" 
              size="small"
            >
              {{ row.grade }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="issueDate" label="发证日期" width="120" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? '有效' : '已撤销' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewCertificate(row)">查看</el-button>
            <el-button 
              v-if="row.status === 1"
              type="danger" 
              link 
              size="small" 
              @click="handleRevoke(row)">
              撤销
            </el-button>
            <el-button 
              v-else
              type="success" 
              link 
              size="small" 
              @click="handleReissue(row)">
              重新发放
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          :current-page="pagination.currentPage"
          :page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handleCertificatePageChange"
          @size-change="handleCertificatePageSizeChange"
        />
      </div>
    </div>

    <el-dialog v-model="showCertDetail" title="证书详情" width="500px">
      <div v-if="currentCert" class="cert-detail">
        <div class="cert-detail-header">
          <svg class="cert-emblem" viewBox="0 0 144 96" aria-hidden="true">
            <defs>
              <linearGradient id="certGold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#8f6b24" />
                <stop offset="0.45" stop-color="#d3ad57" />
                <stop offset="1" stop-color="#8a6420" />
              </linearGradient>
              <linearGradient id="certBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#2f6bc6" />
                <stop offset="1" stop-color="#174b96" />
              </linearGradient>
            </defs>

            <g class="laurel" fill="none" stroke="url(#certGold)" stroke-width="2.2" stroke-linecap="round">
              <path d="M43 77C22 68 17 45 29 26" />
              <path d="M101 77c21-9 26-32 14-51" />
            </g>
            <g fill="url(#certGold)">
              <ellipse cx="29" cy="64" rx="3" ry="8" transform="rotate(-47 29 64)" />
              <ellipse cx="24" cy="52" rx="3" ry="8" transform="rotate(-29 24 52)" />
              <ellipse cx="25" cy="39" rx="3" ry="8" transform="rotate(-10 25 39)" />
              <ellipse cx="34" cy="70" rx="3" ry="8" transform="rotate(-66 34 70)" />
              <ellipse cx="115" cy="64" rx="3" ry="8" transform="rotate(47 115 64)" />
              <ellipse cx="120" cy="52" rx="3" ry="8" transform="rotate(29 120 52)" />
              <ellipse cx="119" cy="39" rx="3" ry="8" transform="rotate(10 119 39)" />
              <ellipse cx="110" cy="70" rx="3" ry="8" transform="rotate(66 110 70)" />
            </g>

            <path d="M57 65 49 91l23-9 23 9-8-26Z" fill="#244f91" opacity=".96" />
            <path d="M61 66 57 84l15-6 15 6-4-18Z" fill="#d9b35f" opacity=".92" />

            <circle cx="72" cy="45" r="28" fill="#fffdf8" stroke="url(#certGold)" stroke-width="3" />
            <circle cx="72" cy="45" r="22" fill="url(#certBlue)" stroke="#e2c171" stroke-width="1.6" />
            <circle cx="72" cy="45" r="17" fill="none" stroke="rgba(255,255,255,.42)" stroke-width="1" />
            <path d="m72 30 4.1 8.4 9.2 1.3-6.7 6.5 1.6 9.1-8.2-4.3-8.2 4.3 1.6-9.1-6.7-6.5 9.2-1.3Z" fill="#f5d786" />
            <circle cx="72" cy="45" r="3.1" fill="#fff7d8" />
          </svg>
          <div class="cert-kicker">CERTIFICATE OF ACHIEVEMENT</div>
          <h3>实验室安全教育考试合格证书</h3>
          <div class="cert-title-rule"><span></span></div>
        </div>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="证书编号">{{ currentCert.certificateNo }}</el-descriptions-item>
          <el-descriptions-item label="学号">{{ currentCert.studentId }}</el-descriptions-item>
          <el-descriptions-item label="姓名">{{ currentCert.studentName }}</el-descriptions-item>
          <el-descriptions-item label="院系">{{ currentCert.department || '-' }}</el-descriptions-item>
          <el-descriptions-item label="考试名称">{{ currentCert.examName }}</el-descriptions-item>
          <el-descriptions-item label="考试成绩">
            <span style="font-weight: bold; color: #0475FA; font-size: 18px">{{ currentCert.score }}分</span>
          </el-descriptions-item>
          <el-descriptions-item label="成绩等级">
            <el-tag :color="getGradeColor(currentCert.grade)" effect="dark">{{ currentCert.grade }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="发证日期">{{ currentCert.issueDate }}</el-descriptions-item>
          <el-descriptions-item label="证书状态">
            <el-tag :type="currentCert.status === 1 ? 'success' : 'info'">
              {{ currentCert.status === 1 ? '有效' : '已撤销' }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="showCertDetail = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.certificates-page {
  .search-form {
    .el-form-item {
      margin-bottom: 0;
    }
  }
  
  .pagination-wrapper {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }

  .cert-detail {
    .cert-detail-header {
      text-align: center;
      margin-bottom: 22px;
      padding-top: 2px;

      .cert-emblem {
        display: block;
        width: 104px;
        height: 70px;
        margin: 0 auto 6px;
        filter: drop-shadow(0 2px 2px rgba(70, 49, 13, 0.12));
      }

      .cert-kicker {
        margin-bottom: 5px;
        color: #9b7a37;
        font-size: 8px;
        font-weight: 600;
        letter-spacing: 1.7px;
      }
      
      h3 {
        margin: 0;
        color: #2b2f36;
        font-size: 17px;
        font-weight: 700;
        letter-spacing: 0.5px;
      }

      .cert-title-rule {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 10px;

        &::before,
        &::after {
          content: '';
          width: 54px;
          height: 1px;
          background: #d8c291;
        }

        span {
          width: 5px;
          height: 5px;
          margin: 0 9px;
          border: 1px solid #b99750;
          transform: rotate(45deg);
          background: #fff;
        }
      }
    }
  }
}
</style>
