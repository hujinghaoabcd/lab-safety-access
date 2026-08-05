<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import * as adminApi from '@/api/admin'

interface Announcement {
  id: number
  content: string
  orderNum: number
  status: number
  createdAt: string
}

const announcements = ref<Announcement[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const dialogTitle = ref('新增公告')
const formRef = ref()

const form = reactive({
  id: 0,
  content: '',
  orderNum: 0,
  status: 1
})

const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 0
})

const loadAnnouncements = async () => {
  loading.value = true
  try {
    const data: any = await adminApi.getAnnouncements({
      page: pagination.currentPage,
      pageSize: pagination.pageSize
    })
    announcements.value = data.list || []
    pagination.total = data.total || 0
  } catch (err: any) {
    ElMessage.error(err?.message || '加载公告列表失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAnnouncements()
})

const handleAdd = () => {
  dialogTitle.value = '新增公告'
  Object.assign(form, {
    id: 0,
    content: '',
    orderNum: 0,
    status: 1
  })
  dialogVisible.value = true
}

const handleEdit = (row: Announcement) => {
  dialogTitle.value = '编辑公告'
  Object.assign(form, {
    id: row.id,
    content: row.content,
    orderNum: row.orderNum,
    status: row.status
  })
  dialogVisible.value = true
}

const handleDelete = async (row: Announcement) => {
  try {
    await ElMessageBox.confirm(`确定要删除这条公告吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await adminApi.deleteAnnouncement(row.id)
    ElMessage.success('删除成功')
    loadAnnouncements()
  } catch (err: any) {
    if (err === 'cancel') return
    ElMessage.error(err?.message || '删除失败')
  }
}

const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    if (form.id) {
      await adminApi.updateAnnouncement(form.id, form)
      ElMessage.success('更新成功')
    } else {
      await adminApi.createAnnouncement(form)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadAnnouncements()
  } catch (err: any) {
    if (err === false) return // 表单验证失败
    ElMessage.error(err?.message || '操作失败')
  }
}

const handleStatusChange = async (row: Announcement) => {
  try {
    await adminApi.updateAnnouncement(row.id, { status: row.status })
    ElMessage.success('状态更新成功')
  } catch (err: any) {
    ElMessage.error(err?.message || '状态更新失败')
    loadAnnouncements() // 恢复原状态
  }
}
const handleAnnouncementPageChange = (page: number) => {
  pagination.currentPage = page
  loadAnnouncements()
}

const handleAnnouncementPageSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.currentPage = 1
  loadAnnouncements()
}

</script>

<template>
  <div class="announcements-page">
    <div class="page-card">
      <div class="page-header">
        <h2>公告管理</h2>
        <el-button type="primary" :icon="Plus" @click="handleAdd">新增公告</el-button>
      </div>

      <el-table v-loading="loading" :data="announcements" stripe border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="content" label="公告内容" min-width="300" show-overflow-tooltip />
        <el-table-column prop="orderNum" label="排序" width="80" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              :active-value="1"
              :inactive-value="0"
              @change="handleStatusChange(row)"
            />
          </template>
        </el-table-column>
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

      <div class="pagination-wrapper">
        <el-pagination
          :current-page="pagination.currentPage"
          :page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handleAnnouncementPageChange"
          @size-change="handleAnnouncementPageSizeChange"
        />
      </div>
    </div>

    <!-- 编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px">
      <el-form ref="formRef" :model="form" label-width="100px">
        <el-form-item
          label="公告内容"
          prop="content"
          :rules="[{ required: true, message: '请输入公告内容' }]"
        >
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="4"
            placeholder="请输入公告内容"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="排序" prop="orderNum">
          <el-input-number v-model="form.orderNum" :min="0" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
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
.announcements-page {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .pagination-wrapper {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>

