<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Upload, Delete, Document, InfoFilled, UploadFilled } from '@element-plus/icons-vue'
import * as adminApi from '@/api/admin'

interface User {
  id: number
  studentId: string
  name: string
  department: string
  class: string
  phone: string
  email: string
  status: number
  createTime: string
}

interface Department {
  id: number
  name: string
}

interface ClassItem {
  id: number
  departmentId: number
  departmentName: string
  name: string
}

// 用户列表
const users = ref<User[]>([])
const loading = ref(false)
const selectedUsers = ref<User[]>([])

// 搜索条件
const searchForm = reactive({
  keyword: '',
  department: '',
  class: '',
  status: ''
})

// 分页
const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 0
})

// 院系和班级数据
const departments = ref<Department[]>([])
const classes = ref<ClassItem[]>([])
const departmentOptions = computed(() => departments.value.map(d => d.name))
const classOptions = computed(() => {
  if (!searchForm.department) return []
  const dept = departments.value.find(d => d.name === searchForm.department)
  if (!dept) return []
  return classes.value.filter(c => c.departmentName === searchForm.department).map(c => c.name)
})

// 加载院系和班级
const loadDepartments = async () => {
  try {
    const data = await adminApi.getDepartments({ page: 1, pageSize: 1000 })
    departments.value = data.list || []
  } catch (err) {
    console.error('加载院系列表失败:', err)
  }
}

const loadClasses = async () => {
  try {
    const data = await adminApi.getClasses({ page: 1, pageSize: 1000 })
    classes.value = data.list || []
  } catch (err) {
    console.error('加载班级列表失败:', err)
  }
}

// 加载用户列表
const loadUsers = async () => {
  loading.value = true
  try {
    const params: any = {
      page: pagination.currentPage,
      pageSize: pagination.pageSize
    }
    if (searchForm.keyword) params.keyword = searchForm.keyword
    if (searchForm.department) params.department = searchForm.department
    if (searchForm.class) params.class = searchForm.class
    if (searchForm.status !== '') params.status = searchForm.status

    const data = await adminApi.getUsers(params)
    users.value = data.list || []
    pagination.total = data.total || 0
    selectedUsers.value = []
  } catch (err) {
    console.error('加载用户列表失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadDepartments()
  await loadClasses()
  await loadUsers()
})

// 弹窗控制
const dialogVisible = ref(false)
const dialogTitle = ref('添加用户')
const formRef = ref()
const userForm = reactive({
  id: 0,
  studentId: '',
  name: '',
  department: '',
  class: '',
  phone: '',
  email: '',
  password: ''
})

const rules = {
  studentId: [{ required: true, message: '请输入学号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  department: [{ required: true, message: '请选择院系', trigger: 'change' }],
  password: [{ required: true, message: '请输入初始密码', trigger: 'blur' }]
}

// 搜索
const handleSearch = () => {
  pagination.currentPage = 1
  loadUsers()
}

// 重置
const handleReset = () => {
  searchForm.keyword = ''
  searchForm.department = ''
  searchForm.class = ''
  searchForm.status = ''
  pagination.currentPage = 1
  loadUsers()
}

// 添加用户
const handleAdd = () => {
  dialogTitle.value = '添加用户'
  Object.assign(userForm, { id: 0, studentId: '', name: '', department: '', class: '', phone: '', email: '', password: '' })
  dialogVisible.value = true
}

// 编辑用户
const handleEdit = (row: User) => {
  dialogTitle.value = '编辑用户'
  Object.assign(userForm, row, { password: '' })
  dialogVisible.value = true
}

// 删除用户
const handleDelete = async (row: User) => {
  try {
    await ElMessageBox.confirm(`确定要删除用户 ${row.name} 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await adminApi.deleteUser(row.id)
    ElMessage.success('删除成功')
    loadUsers()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '删除失败')
    }
  }
}

// 批量删除
const handleBatchDelete = async () => {
  if (selectedUsers.value.length === 0) {
    ElMessage.warning('请选择要删除的用户')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedUsers.value.length} 个用户吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const ids = selectedUsers.value.map(u => u.id)
    await adminApi.batchDeleteUsers(ids)
    ElMessage.success(`成功删除 ${ids.length} 个用户`)
    loadUsers()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '批量删除失败')
    }
  }
}

// 切换状态
const handleStatusChange = async (row: User) => {
  try {
    await adminApi.toggleUserStatus(row.id)
    ElMessage.success(row.status === 1 ? '已禁用' : '已启用')
    loadUsers()
  } catch (err: any) {
    ElMessage.error(err.message || '操作失败')
  }
}

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    if (userForm.id) {
      // 编辑
      await adminApi.updateUser(userForm.id, {
        studentId: userForm.studentId,
        name: userForm.name,
        department: userForm.department,
        class: userForm.class,
        phone: userForm.phone,
        email: userForm.email
      })
      ElMessage.success('编辑成功')
    } else {
      // 添加
      await adminApi.createUser({
        studentId: userForm.studentId,
        name: userForm.name,
        department: userForm.department,
        class: userForm.class,
        phone: userForm.phone,
        email: userForm.email,
        password: userForm.password
      })
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    loadUsers()
  } catch (err: any) {
    ElMessage.error(err.message || '操作失败')
  }
}

// 重置密码
const handleResetPassword = async (row: User) => {
  try {
    await ElMessageBox.confirm(`确定要重置 ${row.name} 的密码吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await adminApi.resetUserPassword(row.id)
    ElMessage.success('密码已重置为: 123456')
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '重置密码失败')
    }
  }
}

// 批量导入
const importDialogVisible = ref(false)
const importFile = ref<File | null>(null)
const importLoading = ref(false)

const handleImport = () => {
  importDialogVisible.value = true
  importFile.value = null
}

const handleFileChange = (file: any) => {
  importFile.value = file.raw
}

const handleImportSubmit = async () => {
  if (!importFile.value) {
    ElMessage.warning('请选择要导入的Excel文件')
    return
  }

  importLoading.value = true
  try {
    const result = await adminApi.batchImportUsers(importFile.value)
    const { success, failed, updated, errors, updatedRows } = result

    // 显示覆盖提醒
    if (updated > 0 && updatedRows && updatedRows.length > 0) {
      const updatedMsg = updatedRows.slice(0, 20).join('\n') + (updatedRows.length > 20 ? `\n...还有 ${updatedRows.length - 20} 条被覆盖` : '')
      ElMessageBox.alert(updatedMsg, '覆盖提醒', {
        type: 'info',
        confirmButtonText: '确定',
        dangerouslyUseHTMLString: false
      })
    }

    // 显示错误信息
    if (failed > 0 && errors && errors.length > 0) {
      const errorMsg = errors.slice(0, 10).join('\n') + (errors.length > 10 ? `\n...还有 ${errors.length - 10} 条错误` : '')
      ElMessageBox.alert(errorMsg, '导入错误', {
        type: 'warning',
        confirmButtonText: '确定'
      })
    }

    // 显示成功消息
    let successMsg = `导入完成: 新增 ${success} 条`
    if (updated > 0) {
      successMsg += `, 覆盖 ${updated} 条`
    }
    if (failed > 0) {
      successMsg += `, 失败 ${failed} 条`
    }
    ElMessage.success(successMsg)
    
    importDialogVisible.value = false
    importFile.value = null
    loadUsers()
  } catch (err: any) {
    ElMessage.error(err.message || '导入失败')
  } finally {
    importLoading.value = false
  }
}

// 表格选择变化
const handleSelectionChange = (selection: User[]) => {
  selectedUsers.value = selection
}

// 分页变化
const handlePageChange = (page: number) => {
  pagination.currentPage = page
  loadUsers()
}

const handlePageSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.currentPage = 1
  loadUsers()
}
</script>

<template>
  <div class="users-page">
    <!-- 搜索栏 -->
    <div class="page-card">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="学号/姓名" clearable />
        </el-form-item>
        <el-form-item label="院系">
          <el-select v-model="searchForm.department" placeholder="请选择" clearable style="width: 150px"
            @change="searchForm.class = ''">
            <el-option v-for="d in departmentOptions" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="班级">
          <el-select v-model="searchForm.class" placeholder="请选择" clearable style="width: 150px"
            :disabled="!searchForm.department">
            <el-option v-for="c in classOptions" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable style="width: 120px">
            <el-option label="启用" value="1" />
            <el-option label="禁用" value="0" />
          </el-select>
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
        <h2>用户列表</h2>
        <div class="header-actions">
          <el-button type="danger" :disabled="selectedUsers.length === 0" @click="handleBatchDelete">
            <el-icon>
              <Delete />
            </el-icon>
            批量删除
          </el-button>
          <el-button type="success" @click="handleImport">
            <el-icon>
              <Upload />
            </el-icon>
            批量导入
          </el-button>
          <el-button type="primary" @click="handleAdd">
            <el-icon>
              <Plus />
            </el-icon>
            添加用户
          </el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="users" stripe border @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column prop="studentId" label="学号" width="160" />
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="department" label="院系" min-width="140" />
        <el-table-column prop="class" label="班级" width="120" />
        <el-table-column prop="phone" label="手机号" width="130" />
        <!-- 邮箱列已去除 -->
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="primary" link size="small" @click="handleResetPassword(row)">重置密码</el-button>
            <el-button :type="row.status === 1 ? 'warning' : 'success'" link size="small"
              @click="handleStatusChange(row)">
              {{ row.status === 1 ? '禁用' : '启用' }}
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination :current-page="pagination.currentPage" :page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]" :total="pagination.total" layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange" @size-change="handlePageSizeChange" />
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form ref="formRef" :model="userForm" :rules="rules" label-width="80px">
        <el-form-item label="学号" prop="studentId">
          <el-input v-model="userForm.studentId" placeholder="请输入学号" />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="userForm.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="院系" prop="department">
          <el-select v-model="userForm.department" placeholder="请选择院系" style="width: 100%"
            @change="userForm.class = ''">
            <el-option v-for="d in departmentOptions" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="班级" prop="class">
          <el-select v-model="userForm.class" placeholder="请选择班级" style="width: 100%" :disabled="!userForm.department">
            <el-option v-for="c in classes.filter(cl => cl.departmentName === userForm.department).map(cl => cl.name)"
              :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="userForm.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="userForm.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item v-if="!userForm.id" label="初始密码" prop="password">
          <el-input v-model="userForm.password" placeholder="请输入初始密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 批量导入弹窗 -->
    <el-dialog v-model="importDialogVisible" title="批量导入用户" width="600px">
      <div class="import-guide">
        <div class="guide-header">
          <el-icon class="guide-icon"><Document /></el-icon>
          <span class="guide-title">Excel 格式说明</span>
        </div>
        <div class="guide-content">
          <div class="guide-item">
            <el-icon class="item-icon"><InfoFilled /></el-icon>
            <div class="item-text">
              <strong>列名要求：</strong>学号、姓名、院系、班级、手机号、邮箱、密码（可选，默认为123456）
            </div>
          </div>
          <div class="guide-item">
            <el-icon class="item-icon"><InfoFilled /></el-icon>
            <div class="item-text">
              <strong>格式要求：</strong>第一行为表头，从第二行开始为数据
            </div>
          </div>
          <div class="guide-example">
            <div class="example-title">示例格式：</div>
            <div class="example-table">
              <table>
                <thead>
                  <tr>
                    <th>学号</th>
                    <th>姓名</th>
                    <th>院系</th>
                    <th>班级</th>
                    <th>手机号</th>
                    <th>邮箱</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>2024001001</td>
                    <td>张三</td>
                    <td>资源与环境学院</td>
                    <td>高年级班</td>
                    <td>13800138001</td>
                    <td>zhangsan@school.edu</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      <div class="upload-section">
        <el-upload 
          :auto-upload="false" 
          :on-change="handleFileChange" 
          :limit="1" 
          accept=".xlsx,.xls"
          drag
          class="upload-area"
        >
          <el-icon class="el-icon--upload"><upload-filled /></el-icon>
          <div class="el-upload__text">
            将文件拖到此处，或<em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              只能上传 xlsx/xls 文件，且不超过 10MB
            </div>
          </template>
        </el-upload>
      </div>
      
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importLoading" @click="handleImportSubmit">确定导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.users-page {
  .search-form {
    .el-form-item {
      margin-bottom: 0;
    }
  }

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

  .pagination-wrapper {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }

  /* 批量导入弹窗样式 */
  .import-guide {
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 24px;
    border: 1px solid #e4e7ed;

    .guide-header {
      display: flex;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #409eff;

      .guide-icon {
        font-size: 24px;
        color: #409eff;
        margin-right: 10px;
      }

      .guide-title {
        font-size: 18px;
        font-weight: 600;
        color: #303133;
      }
    }

    .guide-content {
      .guide-item {
        display: flex;
        align-items: flex-start;
        margin-bottom: 12px;
        padding: 10px;
        background: rgba(255, 255, 255, 0.8);
        border-radius: 6px;
        transition: all 0.3s;

        &:hover {
          background: rgba(255, 255, 255, 1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .item-icon {
          font-size: 18px;
          color: #409eff;
          margin-right: 10px;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .item-text {
          flex: 1;
          line-height: 1.6;
          color: #606266;
          font-size: 14px;

          strong {
            color: #303133;
            font-weight: 600;
          }
        }
      }

      .guide-example {
        margin-top: 16px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.9);
        border-radius: 6px;
        border: 1px solid #dcdfe6;

        .example-title {
          font-size: 14px;
          font-weight: 600;
          color: #303133;
          margin-bottom: 12px;
        }

        .example-table {
          overflow-x: auto;

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;

            thead {
              background: #409eff;
              color: #fff;

              th {
                padding: 10px 8px;
                text-align: left;
                font-weight: 600;
                white-space: nowrap;
                border: 1px solid #66b1ff;
              }
            }

            tbody {
              tr {
                &:nth-child(even) {
                  background: #f5f7fa;
                }

                &:hover {
                  background: #ecf5ff;
                }

                td {
                  padding: 8px;
                  border: 1px solid #e4e7ed;
                  color: #606266;
                  white-space: nowrap;
                }
              }
            }
          }
        }
      }
    }
  }

  .upload-section {
    margin-top: 20px;

    .upload-area {
      :deep(.el-upload) {
        width: 100%;
      }

      :deep(.el-upload-dragger) {
        width: 100%;
        padding: 40px 20px;
        border: 2px dashed #dcdfe6;
        border-radius: 8px;
        background: #fafafa;
        transition: all 0.3s;

        &:hover {
          border-color: #409eff;
          background: #f0f9ff;
        }

        .el-icon--upload {
          font-size: 48px;
          color: #409eff;
          margin-bottom: 16px;
        }

        .el-upload__text {
          color: #606266;
          font-size: 14px;

          em {
            color: #409eff;
            font-style: normal;
            font-weight: 600;
          }
        }
      }

      .el-upload__tip {
        margin-top: 12px;
        text-align: center;
        color: #909399;
        font-size: 12px;
      }
    }
  }
}
</style>
