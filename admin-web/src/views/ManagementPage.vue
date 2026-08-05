<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as adminApi from '../api/admin'

interface Department {
  id: number
  name: string
  createTime?: string
}

interface ClassItem {
  id: number
  departmentId: number
  departmentName: string
  name: string
  createTime?: string
}

const mode = ref<'departments' | 'classes'>('departments')
const loadingDept = ref(false)
const loadingClass = ref(false)

// ============ 院系 ============
const deptKeyword = ref('')
const departments = ref<Department[]>([])
const deptPagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 0
})

const deptDialogVisible = ref(false)
const deptDialogTitle = ref('新增院系')
const deptFormRef = ref()
const deptForm = reactive<{ id: number; name: string }>({ id: 0, name: '' })
const deptRules = {
  name: [{ required: true, message: '请输入院系名称', trigger: 'blur' }]
}

const loadDepartments = async () => {
  loadingDept.value = true
  try {
    const data = await adminApi.getDepartments({
      keyword: deptKeyword.value || undefined,
      page: deptPagination.currentPage,
      pageSize: deptPagination.pageSize
    })
    departments.value = data.list || []
    deptPagination.total = data.total || 0
  } catch (err: any) {
    ElMessage.error(err.message || '加载院系列表失败')
  } finally {
    loadingDept.value = false
  }
}

const handleDeptSearch = () => {
  deptPagination.currentPage = 1
  loadDepartments()
}

const handleDeptReset = () => {
  deptKeyword.value = ''
  deptPagination.currentPage = 1
  loadDepartments()
}

const handleDeptSizeChange = (s: number) => {
  deptPagination.pageSize = s
  deptPagination.currentPage = 1
  loadDepartments()
}

const handleDeptCurrentChange = (p: number) => {
  deptPagination.currentPage = p
  loadDepartments()
}

const openDeptAdd = () => {
  deptDialogTitle.value = '新增院系'
  deptForm.id = 0
  deptForm.name = ''
  deptDialogVisible.value = true
}

const openDeptEdit = (row: Department) => {
  deptDialogTitle.value = '编辑院系'
  deptForm.id = row.id
  deptForm.name = row.name
  deptDialogVisible.value = true
}

const submitDept = async () => {
  await deptFormRef.value?.validate?.()
  try {
    if (deptForm.id) {
      await adminApi.updateDepartment(deptForm.id, { name: deptForm.name })
      ElMessage.success('更新成功')
    } else {
      await adminApi.createDepartment({ name: deptForm.name })
      ElMessage.success('创建成功')
    }
    deptDialogVisible.value = false
    deptPagination.currentPage = 1
    await loadDepartments()
    // 同步刷新班级页的下拉
    await loadDepartmentsForSelect()
  } catch (err: any) {
    ElMessage.error(err.message || '操作失败')
  }
}

const deleteDept = async (row: Department) => {
  try {
    await ElMessageBox.confirm(`确定删除院系「${row.name}」吗？删除后该院系下班级也会被删除。`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await adminApi.deleteDepartment(row.id)
    ElMessage.success('删除成功')
    if (departments.value.length === 1 && deptPagination.currentPage > 1) {
      deptPagination.currentPage -= 1
    }
    await loadDepartments()
    await loadDepartmentsForSelect()
    // 如果当前筛选的是被删院系，重置
    if (selectedDepartmentId.value === row.id) selectedDepartmentId.value = undefined
    await loadClasses()
  } catch (err: any) {
    if (err !== 'cancel') ElMessage.error(err.message || '删除失败')
  }
}

// ============ 班级 ============
const classes = ref<ClassItem[]>([])
const classKeyword = ref('')
const selectedDepartmentId = ref<number | undefined>(undefined)

const deptOptions = ref<Department[]>([])

const loadDepartmentsForSelect = async () => {
  try {
    // 下拉不分页，取较大 pageSize
    const data = await adminApi.getDepartments({ page: 1, pageSize: 1000 })
    deptOptions.value = data.list || []
  } catch {
    // 静默
  }
}

const handleClassSearch = () => {
  classPagination.currentPage = 1
  loadClasses()
}

const handleClassReset = () => {
  selectedDepartmentId.value = undefined
  classKeyword.value = ''
  classPagination.currentPage = 1
  loadClasses()
}

const handleClassSizeChange = (s: number) => {
  classPagination.pageSize = s
  classPagination.currentPage = 1
  loadClasses()
}

const handleClassCurrentChange = (p: number) => {
  classPagination.currentPage = p
  loadClasses()
}

const classPagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 0
})

const loadClasses = async () => {
  loadingClass.value = true
  try {
    const params: any = {}
    if (selectedDepartmentId.value) params.departmentId = selectedDepartmentId.value
    if (classKeyword.value) params.keyword = classKeyword.value
    params.page = classPagination.currentPage
    params.pageSize = classPagination.pageSize
    const data = await adminApi.getClasses(params)
    classes.value = data.list || []
    classPagination.total = data.total || 0
  } catch (err: any) {
    ElMessage.error(err.message || '加载班级列表失败')
  } finally {
    loadingClass.value = false
  }
}

const classDialogVisible = ref(false)
const classDialogTitle = ref('新增班级')
const classFormRef = ref()
const classForm = reactive<{ id: number; departmentId: number | undefined; name: string }>({
  id: 0,
  departmentId: undefined,
  name: ''
})
const classRules = {
  departmentId: [{ required: true, message: '请选择所属院系', trigger: 'change' }],
  name: [{ required: true, message: '请输入班级名称', trigger: 'blur' }]
}

const openClassAdd = () => {
  classDialogTitle.value = '新增班级'
  classForm.id = 0
  classForm.departmentId = selectedDepartmentId.value
  classForm.name = ''
  classDialogVisible.value = true
}

const openClassEdit = (row: ClassItem) => {
  classDialogTitle.value = '编辑班级'
  classForm.id = row.id
  classForm.departmentId = row.departmentId
  classForm.name = row.name
  classDialogVisible.value = true
}

const submitClass = async () => {
  await classFormRef.value?.validate?.()
  try {
    const payload = { departmentId: classForm.departmentId as number, name: classForm.name }
    if (classForm.id) {
      await adminApi.updateClass(classForm.id, payload)
      ElMessage.success('更新成功')
    } else {
      await adminApi.createClass(payload)
      ElMessage.success('创建成功')
    }
    classDialogVisible.value = false
    classPagination.currentPage = 1
    await loadClasses()
  } catch (err: any) {
    ElMessage.error(err.message || '操作失败')
  }
}

const deleteClass = async (row: ClassItem) => {
  try {
    await ElMessageBox.confirm(`确定删除班级「${row.name}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await adminApi.deleteClass(row.id)
    ElMessage.success('删除成功')
    if (classes.value.length === 1 && classPagination.currentPage > 1) {
      classPagination.currentPage -= 1
    }
    await loadClasses()
  } catch (err: any) {
    if (err !== 'cancel') ElMessage.error(err.message || '删除失败')
  }
}

onMounted(async () => {
  await loadDepartments()
  await loadDepartmentsForSelect()
  await loadClasses()
})
</script>

<template>
  <div class="management-page">
    <!-- 搜索卡片（上） -->
    <div class="page-card">
      <el-form :inline="true" class="search-form">
        <el-form-item label="管理类型">
          <el-radio-group v-model="mode">
            <el-radio-button label="departments">院系</el-radio-button>
            <el-radio-button label="classes">班级</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <template v-if="mode === 'departments'">
          <el-form-item label="关键词">
            <el-input v-model="deptKeyword" placeholder="院系名称" clearable />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleDeptSearch">搜索</el-button>
            <el-button @click="handleDeptReset">重置</el-button>
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="院系">
            <el-select v-model="selectedDepartmentId" placeholder="请选择" clearable style="width: 180px">
              <el-option v-for="d in deptOptions" :key="d.id" :label="d.name" :value="d.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="关键词">
            <el-input v-model="classKeyword" placeholder="班级名称" clearable />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleClassSearch">搜索</el-button>
            <el-button @click="handleClassReset">重置</el-button>
          </el-form-item>
        </template>
      </el-form>
    </div>

    <!-- 列表卡片（下） -->
    <div class="page-card">
      <div class="page-header">
        <h2>{{ mode === 'departments' ? '院系列表' : '班级列表' }}</h2>
        <el-button type="primary" @click="mode === 'departments' ? openDeptAdd() : openClassAdd()">
          {{ mode === 'departments' ? '新增院系' : '新增班级' }}
        </el-button>
      </div>

      <el-table
        v-if="mode === 'departments'"
        v-loading="loadingDept"
        :data="departments"
        stripe
        border
      >
        <el-table-column prop="name" label="院系名称" min-width="240" />
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openDeptEdit(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="deleteDept(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-table
        v-else
        v-loading="loadingClass"
        :data="classes"
        stripe
        border
      >
        <el-table-column prop="departmentName" label="所属院系" min-width="220" />
        <el-table-column prop="name" label="班级名称" min-width="220" />
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openClassEdit(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="deleteClass(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-if="mode === 'departments'"
          :current-page="deptPagination.currentPage"
          :page-size="deptPagination.pageSize"
          :total="deptPagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleDeptSizeChange"
          @current-change="handleDeptCurrentChange"
        />
        <el-pagination
          v-else
          :current-page="classPagination.currentPage"
          :page-size="classPagination.pageSize"
          :total="classPagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleClassSizeChange"
          @current-change="handleClassCurrentChange"
        />
      </div>
    </div>

    <!-- 院系弹窗 -->
    <el-dialog v-model="deptDialogVisible" :title="deptDialogTitle" width="520px">
      <el-form ref="deptFormRef" :model="deptForm" :rules="deptRules" label-width="90px">
        <el-form-item label="院系名称" prop="name">
          <el-input v-model="deptForm.name" placeholder="请输入院系名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="deptDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitDept">确定</el-button>
      </template>
    </el-dialog>

    <!-- 班级弹窗 -->
    <el-dialog v-model="classDialogVisible" :title="classDialogTitle" width="560px">
      <el-form ref="classFormRef" :model="classForm" :rules="classRules" label-width="90px">
        <el-form-item label="所属院系" prop="departmentId">
          <el-select v-model="classForm.departmentId" placeholder="请选择院系" style="width: 100%">
            <el-option v-for="d in deptOptions" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="班级名称" prop="name">
          <el-input v-model="classForm.name" placeholder="例如：2024级1班" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="classDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitClass">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.management-page {
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #303133;
    }
  }

  .sub-card {
    margin-top: 12px;
  }

  .search-form {
    :deep(.el-form-item) {
      margin-bottom: 0;
    }
  }

  .pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }
}
</style>
