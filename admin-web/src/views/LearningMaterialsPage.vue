<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import * as adminApi from '@/api/admin'

interface LearningMaterial {
  id: number
  title: string
  description: string
  content: string
  duration: string
  category: string
  orderNum: number
  createdAt: string
}

const materials = ref<LearningMaterial[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const dialogTitle = ref('新增学习资料')
const formRef = ref()
const selectedMaterials = ref<LearningMaterial[]>([])
const uploadHeaders = ref<Record<string, string>>({
  Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`
})

const form = reactive({
  id: 0,
  title: '',
  description: '',
  content: '',
  duration: '',
  category: '',
  orderNum: 0
})

const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 0
})

const searchForm = reactive({
  keyword: '',
  category: ''
})

const loadMaterials = async () => {
  loading.value = true
  try {
    const params: any = {
      page: pagination.currentPage,
      pageSize: pagination.pageSize
    }
    if (searchForm.keyword) params.keyword = searchForm.keyword
    if (searchForm.category) params.category = searchForm.category

    const data: any = await adminApi.getLearningMaterials(params)
    materials.value = data.list || []
    pagination.total = data.total || 0
  } catch (err: any) {
    ElMessage.error(err?.message || '加载学习资料列表失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadMaterials()
})

const handleAdd = () => {
  dialogTitle.value = '新增学习资料'
  Object.assign(form, {
    id: 0,
    title: '',
    description: '',
    content: '',
    duration: '',
    category: '',
    orderNum: 0
  })
  dialogVisible.value = true
}

const handleEdit = (row: LearningMaterial) => {
  dialogTitle.value = '编辑学习资料'
  Object.assign(form, {
    id: row.id,
    title: row.title,
    description: row.description,
    content: row.content,
    duration: row.duration,
    category: row.category,
    orderNum: row.orderNum
  })
  dialogVisible.value = true
}

const handleDelete = async (row: LearningMaterial) => {
  try {
    await ElMessageBox.confirm(`确定要删除学习资料"${row.title}"吗？删除后相关的学习进度也会被删除。`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await adminApi.deleteLearningMaterial(row.id)
    ElMessage.success('删除成功')
    loadMaterials()
  } catch (err: any) {
    if (err === 'cancel') return
    ElMessage.error(err?.message || '删除失败')
  }
}

const handleBatchDelete = async () => {
  if (selectedMaterials.value.length === 0) {
    ElMessage.warning('请选择要删除的学习资料')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedMaterials.value.length} 个学习资料吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const ids = selectedMaterials.value.map(item => item.id)
    await adminApi.batchDeleteLearningMaterials(ids)
    ElMessage.success('批量删除成功')
    selectedMaterials.value = []
    loadMaterials()
  } catch (err: any) {
    if (err === 'cancel') return
    ElMessage.error(err?.message || '批量删除失败')
  }
}

const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    if (form.id) {
      await adminApi.updateLearningMaterial(form.id, {
        title: form.title,
        description: form.description,
        content: form.content,
        duration: form.duration,
        category: form.category,
        orderNum: form.orderNum
      })
      ElMessage.success('更新成功')
    } else {
      await adminApi.createLearningMaterial({
        title: form.title,
        description: form.description,
        content: form.content,
        duration: form.duration,
        category: form.category,
        orderNum: form.orderNum
      })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadMaterials()
  } catch (err: any) {
    if (err === 'cancel') return
    ElMessage.error(err?.message || '操作失败')
  }
}

const handleSearch = () => {
  pagination.currentPage = 1
  loadMaterials()
}

const handleReset = () => {
  searchForm.keyword = ''
  searchForm.category = ''
  pagination.currentPage = 1
  loadMaterials()
}

const rules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  content: [
    { required: true, message: '请上传 PDF 文件', trigger: 'change' }
  ]
}

const handleUploadSuccess = (response: any) => {
  if (response && response.code === 0 && response.data && response.data.url) {
    form.content = response.data.url
    ElMessage.success('上传成功')
  } else {
    ElMessage.error(response?.message || '上传失败')
  }
}

const handleUploadError = () => {
  ElMessage.error('上传失败，请重试')
}

const beforeUpload = (file: File) => {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) {
    ElMessage.error('只能上传 PDF 文件')
    return false
  }
  const isLt50M = file.size / 1024 / 1024 < 50
  if (!isLt50M) {
    ElMessage.error('文件大小不能超过 50MB')
    return false
  }
  return true
}

const getFileName = (url: string) => {
  if (!url) return ''
  try {
    const parts = url.split('/')
    return parts[parts.length - 1]
  } catch {
    return url
  }
}
</script>

<template>
  <div class="learning-materials-page">
    <div class="page-header">
      <h2>学习资料管理</h2>
      <div class="header-actions">
        <el-button type="danger" :disabled="selectedMaterials.length === 0" @click="handleBatchDelete">
          批量删除
        </el-button>
        <el-button type="primary" :icon="Plus" @click="handleAdd">新增学习资料</el-button>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <el-input
        v-model="searchForm.keyword"
        placeholder="搜索标题或描述"
        style="width: 300px"
        clearable
        @keyup.enter="handleSearch"
      />
      <el-input
        v-model="searchForm.category"
        placeholder="分类"
        style="width: 200px"
        clearable
      />
      <el-button type="primary" @click="handleSearch">搜索</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>

    <!-- 表格 -->
    <el-table
      v-loading="loading"
      :data="materials"
      stripe
      border
      @selection-change="selectedMaterials = $event"
    >
      <el-table-column type="selection" width="55" />
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="title" label="标题" min-width="200" />
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column prop="content" label="PDF 文件" min-width="250" show-overflow-tooltip>
        <template #default="{ row }">
          <a
            v-if="row.content"
            :href="row.content"
            target="_blank"
            style="color: #0475FA; text-decoration: none"
          >
            预览 PDF（{{ getFileName(row.content) }}）
          </a>
          <span v-else style="color: #909399">未上传</span>
        </template>
      </el-table-column>
      <el-table-column prop="duration" label="预计时长" width="120" />
      <el-table-column prop="category" label="分类" width="120" />
      <el-table-column prop="orderNum" label="排序" width="80" />
      <el-table-column prop="createdAt" label="创建时间" width="180" />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link size="small" :icon="Edit" @click="handleEdit(row)">
            编辑
          </el-button>
          <el-button type="danger" link size="small" :icon="Delete" @click="handleDelete(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-wrapper">
      <el-pagination
        :current-page="pagination.currentPage"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadMaterials"
        @current-change="loadMaterials"
      />
    </div>

    <!-- 编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入标题" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="请输入描述"
          />
        </el-form-item>
        <el-form-item label="PDF 文件" prop="content">
          <el-upload
            class="upload-block"
            action="/api/admin/learning-materials/upload"
            :headers="uploadHeaders"
            :show-file-list="false"
            accept=".pdf"
            :before-upload="beforeUpload"
            :on-success="handleUploadSuccess"
            :on-error="handleUploadError"
          >
            <el-button type="primary">上传 PDF</el-button>
            <span v-if="form.content" class="uploaded-tip">
              已上传：{{ getFileName(form.content) }}
            </span>
            <span v-else class="uploaded-tip">请选择要上传的 PDF 文件</span>
          </el-upload>
        </el-form-item>
        <el-form-item label="预计时长" prop="duration">
          <el-input v-model="form.duration" placeholder="例如：约 30 分钟" />
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-input v-model="form.category" placeholder="例如：安全规范、操作指南" />
        </el-form-item>
        <el-form-item label="排序" prop="orderNum">
          <el-input-number v-model="form.orderNum" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.learning-materials-page {
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }
  }

  .search-bar {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .pagination-wrapper {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }

  .form-tip {
    margin-top: 4px;
    font-size: 12px;
    color: #909399;
  }

  .upload-block {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .uploaded-tip {
    font-size: 12px;
    color: #909399;
  }
}
</style>

