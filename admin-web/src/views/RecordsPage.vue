<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as adminApi from '@/api/admin'

interface Record {
  id: number
  studentId: string
  studentName: string
  examName: string
  score: number
  status: string
  duration: string
  submitTime: string
}

const records = ref<Record[]>([])
const loading = ref(false)

const searchForm = reactive({
  keyword: ''
})

const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 0
})

const loadRecords = async () => {
  loading.value = true
  try {
    const params: any = {
      page: pagination.currentPage,
      pageSize: pagination.pageSize
    }
    if (searchForm.keyword) params.keyword = searchForm.keyword

    const data: any = await adminApi.getRecords(params)
    const list = Array.isArray(data?.list) ? data.list : []
    records.value = list
    pagination.total = data?.total ?? list.length
    if (typeof data?.page === 'number') pagination.currentPage = data.page
    if (typeof data?.pageSize === 'number') pagination.pageSize = data.pageSize
  } catch (err: any) {
    console.error('加载考试记录失败:', err)
    ElMessage.error(err?.message || '加载考试记录失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadRecords()
})

const handleSearch = () => {
  pagination.currentPage = 1
  loadRecords()
}

const handleReset = () => {
  searchForm.keyword = ''
  pagination.currentPage = 1
  loadRecords()
}

const handleExport = async () => {
  try {
    const params: any = {}
    if (searchForm.keyword) params.keyword = searchForm.keyword
    const data: any = await adminApi.exportRecords(params)
    const url = data?.url || '/exports/records.xlsx'
    window.open(url, '_blank')
  } catch (err: any) {
    console.error('导出考试记录失败:', err)
    ElMessage.error(err?.message || '导出失败')
  }
}

const handleDelete = async (row: Record) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除【${row.studentName}】的考试记录「${row.examName}」吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await adminApi.deleteRecord(row.id)
    ElMessage.success('删除成功')
    // 如果当前页删空了，自动回到上一页
    if (records.value.length === 1 && pagination.currentPage > 1) {
      pagination.currentPage -= 1
    }
    loadRecords()
  } catch (err: any) {
    if (err === 'cancel') return
    console.error('删除考试记录失败:', err)
    ElMessage.error(err?.message || '删除失败')
  }
}
</script>

<template>
  <div class="records-page">
    <!-- 搜索栏 -->
    <div class="page-card">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="学号/姓名" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 表格 -->
    <div class="page-card">
      <div class="page-header">
        <h2>考试记录</h2>
        <el-button type="success" @click="handleExport">
          <el-icon><Download /></el-icon>
          导出数据
        </el-button>
      </div>

      <el-table v-loading="loading" :data="records" stripe border>
        <el-table-column prop="studentId" label="学号" width="170" />
        <el-table-column prop="studentName" label="姓名" width="100" />
        <el-table-column prop="examName" label="考试名称" min-width="200" />
        <el-table-column prop="score" label="分数" width="80">
          <template #default="{ row }">
            <span :style="{ color: row.score >= 60 ? '#67c23a' : '#f56c6c', fontWeight: 'bold' }">
              {{ row.score }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === '通过' ? 'success' : 'danger'" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="duration" label="用时" width="100" />
        <el-table-column prop="submitTime" label="提交时间" width="180" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
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
          @current-change="(page) => { pagination.currentPage = page; loadRecords() }"
          @size-change="(size) => { pagination.pageSize = size; pagination.currentPage = 1; loadRecords() }"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.records-page {
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
}
</style>

