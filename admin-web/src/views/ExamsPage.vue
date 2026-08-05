<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as adminApi from '@/api/admin'

interface Exam {
  id: number
  name: string
  // category: string // 已移除
  duration: number
  totalScore: number
  passScore: number
  questionCount: number
  status: number
  createTime: string
}

const exams = ref<Exam[]>([])
const loading = ref(false)

// 分页
const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 0
})

// 已移除考试类型，无需分类选项

const searchForm = reactive({
  keyword: '',
  status: '' as '' | '0' | '1'
})

const dialogVisible = ref(false)
const dialogTitle = ref('添加考试')
const formRef = ref()
const publishDialogVisible = ref(false)
const currentExam = ref<Exam | null>(null)
const assignments = ref<{ department: string, class: string }[]>([])

const examForm = reactive({
  id: 0,
  name: '',
  duration: 60,
  totalScore: 100,
  passScore: 60,
  questionCount: 50,
  description: ''
})

// 默认考试说明（创建考试时自动带出）
const defaultDescriptionLines = [
  '考试过程中请保持网络稳定，不要随意退出或刷新页面。',
  '请独立完成答题，严禁代考、抄袭等违规行为。',
  '考试时间结束后系统将自动提交试卷，请合理安排答题时间。'
]

// 考试说明：按条输入（每行一条），提交时再合并成字符串存储
const descriptionItems = ref<string[]>([])
const syncDescriptionToItems = () => {
  const raw = (examForm.description || '').toString()
  const lines = raw
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
  descriptionItems.value = lines.length ? lines : ['']
}
const syncItemsToDescription = () => {
  const lines = (descriptionItems.value || []).map(s => (s || '').trim()).filter(Boolean)
  examForm.description = lines.join('\n')
}
const addDescriptionItem = () => {
  descriptionItems.value.push('')
}
const removeDescriptionItem = (idx: number) => {
  if (descriptionItems.value.length <= 1) {
    descriptionItems.value = ['']
    return
  }
  descriptionItems.value.splice(idx, 1)
}

const rules = {
  name: [{ required: true, message: '请输入考试名称', trigger: 'blur' }],
  duration: [{ required: true, message: '请输入考试时长', trigger: 'blur' }],
  passScore: [{ required: true, message: '请输入及格分数', trigger: 'blur' }],
  questionCount: [{ required: true, message: '请输入题目数量', trigger: 'blur' }]
}

// 加载考试列表
const loadExams = async () => {
  loading.value = true
  try {
    const params: any = {
      page: pagination.currentPage,
      pageSize: pagination.pageSize
    }
    if (searchForm.keyword) params.keyword = searchForm.keyword
    if (searchForm.status !== '' && searchForm.status != null) params.status = searchForm.status

    const data: any = await adminApi.getExams(params)
    // 后端已返回分页结构 { list, total, page, pageSize }
    const list = Array.isArray((data as any)?.list) ? (data as any).list : Array.isArray(data) ? data : []
    exams.value = list
    pagination.total = (data as any)?.total ?? list.length
    if (typeof (data as any)?.page === 'number') pagination.currentPage = (data as any).page
    if (typeof (data as any)?.pageSize === 'number') pagination.pageSize = (data as any).pageSize
  } catch (err) {
    console.error('加载考试列表失败:', err)
  } finally {
    loading.value = false
  }
}

interface DepartmentOption {
  id: number
  name: string
}

interface ClassOption {
  id: number
  name: string
  departmentId: number
  departmentName: string
}

// 发布范围用的院系/班级选项（从后端加载）
const publishDepartments = ref<DepartmentOption[]>([])
const publishClasses = ref<ClassOption[]>([])

// 当前正在添加的发布范围（院系按名称保存，和后端班级里的 departmentName 对应）
const newAssignment = reactive({
  department: '' as string,
  classes: [] as string[]
})

// 班级选项：按院系名称过滤，逻辑与 UsersPage 保持一致
const publishClassOptions = computed(() => {
  if (!newAssignment.department) return []
  return publishClasses.value.filter(c => c.departmentName === newAssignment.department)
})

const addAssignment = () => {
  if (!newAssignment.department) {
    ElMessage.warning('请选择院系')
    return
  }
  // 如果没有选择班级，则表示该院系全体
  const classesToAdd = (newAssignment.classes && newAssignment.classes.length > 0)
    ? newAssignment.classes
    : ['']

  let added = 0
  for (const cls of classesToAdd) {
    const exists = assignments.value.some(
      a => a.department === newAssignment.department && a.class === cls
    )
    if (exists) continue
    assignments.value.push({
      department: newAssignment.department,
      class: cls
    })
    added++
  }

  if (added === 0) {
    ElMessage.warning('该发布范围已存在')
    return
  }

  newAssignment.department = ''
  newAssignment.classes = []
}

const removeAssignment = (index: number) => {
  assignments.value.splice(index, 1)
}

const handleSaveAssignments = async () => {
  if (!currentExam.value) return
  try {
    await adminApi.updateExamAssignments(currentExam.value.id, assignments.value)
    ElMessage.success('发布范围已保存')
    publishDialogVisible.value = false
  } catch (err: any) {
    ElMessage.error(err.message || '保存失败')
  }
}

// 加载发布范围用的院系/班级
const loadPublishDepartments = async () => {
  try {
    const data: any = await adminApi.getDepartments({ page: 1, pageSize: 1000 })
    publishDepartments.value = data.list || []
  } catch (err) {
    console.error('加载院系列表失败:', err)
  }
}

const loadPublishClasses = async () => {
  try {
    const data: any = await adminApi.getClasses({ page: 1, pageSize: 1000 })
    publishClasses.value = data.list || []
  } catch (err) {
    console.error('加载班级列表失败:', err)
  }
}

onMounted(() => {
  loadExams()
  loadPublishDepartments()
  loadPublishClasses()
})

const handleSearch = () => {
  pagination.currentPage = 1
  loadExams()
}

const handleReset = () => {
  searchForm.keyword = ''
  searchForm.status = ''
  pagination.currentPage = 1
  loadExams()
}

const handlePageChange = (page: number) => {
  pagination.currentPage = page
  loadExams()
}

const handlePageSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.currentPage = 1
  loadExams()
}


const handleAdd = () => {
  dialogTitle.value = '添加考试'
  Object.assign(examForm, {
    id: 0,
    name: '',
    duration: 60,
    totalScore: 100,
    passScore: 60,
    questionCount: 50,
    description: defaultDescriptionLines.join('\n')
  })
  syncDescriptionToItems()
  dialogVisible.value = true
}

const handleEdit = (row: Exam) => {
  dialogTitle.value = '编辑考试'
  Object.assign(examForm, row)
  syncDescriptionToItems()
  dialogVisible.value = true
}

// ============ 题目配置 ============
interface QuestionLite {
  id: number
  content: string
  type: string
  category: string
}

const questionDialogVisible = ref(false)
const questionDialogLoading = ref(false)
const questionDialogSaving = ref(false)
const questionDialogExam = ref<Exam | null>(null)

const selectedInExam = ref<QuestionLite[]>([])
const originalExamQuestionIds = ref<number[]>([])

const bankLoading = ref(false)
const bankList = ref<QuestionLite[]>([])
const bankTotal = ref(0)
const bankQuery = reactive({
  category: '',
  type: '',
  page: 1,
  pageSize: 10 // 固定10条每页
})
const bankSelected = ref<QuestionLite[]>([])
const bankCategories = ['通用安全','化学安全', '生物安全', '辐射安全', '电气安全','消防安全']
const bankTypes = ['单选题', '多选题', '判断题']

// 已选题目筛选和分页
const selectedFilter = reactive({
  category: '',
  type: ''
})
const selectedPagination = reactive({
  currentPage: 1,
  pageSize: 10
})

const filteredSelectedInExam = computed(() => {
  let result = selectedInExam.value
  if (selectedFilter.category) {
    result = result.filter(q => q.category === selectedFilter.category)
  }
  if (selectedFilter.type) {
    result = result.filter(q => q.type === selectedFilter.type)
  }
  return result
})

const paginatedSelectedInExam = computed(() => {
  const start = (selectedPagination.currentPage - 1) * selectedPagination.pageSize
  const end = start + selectedPagination.pageSize
  return filteredSelectedInExam.value.slice(start, end)
})

const selectedTotal = computed(() => filteredSelectedInExam.value.length)

const onSelectedPageChange = (page: number) => {
  selectedPagination.currentPage = page
}

const loadExamQuestions = async () => {
  if (!questionDialogExam.value) return
  try {
    const data: any = await adminApi.getExamQuestions(questionDialogExam.value.id)
    const list: QuestionLite[] = (data || []).map((q: any) => ({
      id: q.id,
      content: q.content,
      type: q.type,
      category: q.category
    }))
    selectedInExam.value = list
    originalExamQuestionIds.value = list.map(q => q.id)
  } catch (e: any) {
    ElMessage.error(e.message || '加载考试题目失败')
  }
}

const openQuestionConfig = async (row: Exam) => {
  questionDialogExam.value = row
  questionDialogVisible.value = true
  questionDialogLoading.value = true
  try {
    await loadExamQuestions()
    bankSelected.value = []
    bankQuery.page = 1
    await loadBank()
  } catch (e: any) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    questionDialogLoading.value = false
  }
}

const loadBank = async () => {
  bankLoading.value = true
  try {
    const params: any = {
      page: bankQuery.page,
      pageSize: bankQuery.pageSize,
      unassigned: 1
    }
    if (bankQuery.category) params.category = bankQuery.category
    if (bankQuery.type) params.type = bankQuery.type

    const data: any = await adminApi.getQuestions(params)
    bankList.value = (data?.list || []).map((q: any) => ({
      id: q.id,
      content: q.content,
      type: q.type,
      category: q.category
    }))
    bankTotal.value = data?.total || 0
  } finally {
    bankLoading.value = false
  }
}

const addFromBank = () => {
  if (!questionDialogExam.value) return
  
  const existing = new Set(selectedInExam.value.map(q => q.id))
  const toAdd = bankSelected.value.filter(q => !existing.has(q.id))
  if (toAdd.length === 0) {
    ElMessage.warning('请先选择要添加的题目')
    return
  }
  
  // 检查数量限制
  const targetCount = questionDialogExam.value.questionCount || 0
  const currentCount = selectedInExam.value.length
  const willExceed = currentCount + toAdd.length > targetCount
  
  if (targetCount > 0 && willExceed) {
    const canAdd = targetCount - currentCount
    if (canAdd <= 0) {
      ElMessage.warning(`已达到题目数量上限（${targetCount} 道），无法继续添加。如需添加新题目，请先移除部分已选题目。`)
      return
    } else {
      ElMessageBox.confirm(
        `当前已选 ${currentCount} 道题目，考试设置的题目数量为 ${targetCount} 道。\n只能再添加 ${canAdd} 道题目，是否只添加前 ${canAdd} 道？`,
        '题目数量限制',
        {
          confirmButtonText: '只添加前' + canAdd + '道',
          cancelButtonText: '取消',
          type: 'warning'
        }
      ).then(() => {
        const limitedAdd = toAdd.slice(0, canAdd)
        selectedInExam.value = [...selectedInExam.value, ...limitedAdd]
        bankSelected.value = []
        ElMessage.success(`已添加 ${limitedAdd.length} 道题（已达到上限 ${targetCount} 道）`)
      }).catch(() => {
        // 用户取消
      })
      return
    }
  }
  
  // 正常添加
  selectedInExam.value = [...selectedInExam.value, ...toAdd]
  bankSelected.value = []
  ElMessage.success(`已添加 ${toAdd.length} 道题`)
}

const onBankSelectionChange = (rows: QuestionLite[]) => {
  bankSelected.value = rows || []
}
const onBankPageChange = (p: number) => {
  bankQuery.page = p
  loadBank()
}

const removeFromExam = (q: QuestionLite) => {
  selectedInExam.value = selectedInExam.value.filter(x => x.id !== q.id)
}

const autoSelectQuestions = async () => {
  if (!questionDialogExam.value) return
  try {
    const questionCount = questionDialogExam.value.questionCount || 50
    await ElMessageBox.confirm(
      `确定要自动抽题吗？将根据考试设置的题目数量（${questionCount} 道）自动抽取，题型比例：单选题50%、多选题30%、判断题20%。`,
      '自动抽题',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    questionDialogLoading.value = true
    const result = await adminApi.autoSelectQuestions(questionDialogExam.value.id)
    // 响应拦截器已经返回了 res.data，所以 result 直接就是数据对象
    const questionCountResult = result?.questionCount || 0
    const stats = result?.stats || {}
    ElMessage.success(`自动抽题完成：已抽取 ${questionCountResult} 道题目（${stats['单选题'] || 0} 单选，${stats['多选题'] || 0} 多选，${stats['判断题'] || 0} 判断）`)
    // 重新加载已选题目
    await loadExamQuestions()
    loadExams() // 刷新考试列表（更新题目数）
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e.message || '自动抽题失败')
    }
  } finally {
    questionDialogLoading.value = false
  }
}

const saveQuestionConfig = async () => {
  if (!questionDialogExam.value) return
  questionDialogSaving.value = true
  try {
    const nowIds = new Set(selectedInExam.value.map(q => q.id))
    const oldIds = new Set(originalExamQuestionIds.value)
    const addIds: number[] = []
    const removeIds: number[] = []
    for (const id of nowIds) if (!oldIds.has(id)) addIds.push(id)
    for (const id of oldIds) if (!nowIds.has(id)) removeIds.push(id)

    await adminApi.configExamQuestions(questionDialogExam.value.id, { addIds, removeIds })
    ElMessage.success('题目配置已保存')
    questionDialogVisible.value = false
    loadExams()
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    questionDialogSaving.value = false
  }
}

const handleDelete = async (row: Exam) => {
  try {
    await ElMessageBox.confirm(`确定要删除考试 "${row.name}" 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await adminApi.deleteExam(row.id)
    ElMessage.success('删除成功')
    loadExams()
  } catch (err: any) {
    ElMessage.error(err.message || '删除失败')
  }
}

const handlePublish = async (row: Exam) => {
  currentExam.value = row
  // 每次打开前重置选择状态
  newAssignment.department = ''
  newAssignment.classes = []
  try {
    // 确保院系和班级选项是最新的
    await Promise.all([loadPublishDepartments(), loadPublishClasses()])
    const data = await adminApi.getExamAssignments(row.id)
    assignments.value = data || []
    publishDialogVisible.value = true
  } catch (err) {
    console.error('获取发布范围失败:', err)
    ElMessage.error('获取发布范围失败')
  }
}

const handleStatusChange = async (row: Exam) => {
  try {
    await adminApi.toggleExamStatus(row.id)
    ElMessage.success(row.status === 1 ? '已下架' : '已发布')
    loadExams()
  } catch (err: any) {
    ElMessage.error(err.message || '操作失败')
  }
}

const handleSubmit = async () => {
  try {
    syncItemsToDescription()
    await formRef.value.validate()
    if (examForm.id) {
      await adminApi.updateExam(examForm.id, {
        name: examForm.name,
        description: examForm.description,
        duration: examForm.duration,
        totalScore: examForm.totalScore,
        passScore: examForm.passScore,
        questionCount: examForm.questionCount
      })
      ElMessage.success('编辑成功')
    } else {
      await adminApi.createExam({
        name: examForm.name,
        description: examForm.description,
        duration: examForm.duration,
        totalScore: examForm.totalScore,
        passScore: examForm.passScore,
        questionCount: examForm.questionCount
      })
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    loadExams()
  } catch (err: any) {
    ElMessage.error(err.message || '操作失败')
  }
}
</script>

<template>
  <div class="exams-page">
    <!-- 搜索栏 -->
    <div class="page-card">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="考试名称" clearable style="width: 220px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="searchForm.status"
            placeholder="请选择"
            clearable
            style="width: 160px"
            @clear="searchForm.status = ''"
          >
            <el-option label="已发布" value="1" />
            <el-option label="未发布" value="0" />
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
        <h2>考试列表</h2>
        <el-button type="primary" @click="handleAdd">
          <el-icon>
            <Plus />
          </el-icon>
          添加考试
        </el-button>
      </div>

      <el-table v-loading="loading" :data="exams" stripe border>
        <el-table-column prop="name" label="考试名称" min-width="200" />
        <el-table-column prop="duration" label="时长(分钟)" width="100" />
        <el-table-column prop="questionCount" label="题目数" width="80" />
        <el-table-column prop="totalScore" label="总分" width="80" />
        <el-table-column prop="passScore" label="及格分" width="80" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? '已发布' : '未发布' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="170" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div class="op-col">
              <el-button type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button type="primary" link size="small" @click="openQuestionConfig(row)">题目配置</el-button>
              <el-button type="primary" link size="small" @click="handlePublish(row)">发布范围</el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <div class="op-col">
              <el-button
                :type="row.status === 1 ? 'warning' : 'success'"
                link
                size="small"
                @click="handleStatusChange(row)"
              >
                {{ row.status === 1 ? '下架' : '发布' }}
              </el-button>
              <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
            </div>
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
          @current-change="handlePageChange"
          @size-change="handlePageSizeChange"
        />
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px">
      <el-form ref="formRef" :model="examForm" :rules="rules" label-width="100px">
        <el-form-item label="考试名称" prop="name">
          <el-input v-model="examForm.name" placeholder="请输入考试名称" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="考试时长" prop="duration">
              <el-input-number v-model="examForm.duration" :min="10" :max="180" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="题目数量" prop="questionCount">
              <el-input-number v-model="examForm.questionCount" :min="1" :max="200" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="总分" prop="totalScore">
              <el-input-number v-model="examForm.totalScore" :min="10" :max="200" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="及格分数" prop="passScore">
              <el-input-number v-model="examForm.passScore" :min="1" :max="examForm.totalScore" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="考试说明">
          <div class="desc-list">
            <div v-for="(_, idx) in descriptionItems" :key="idx" class="desc-row">
              <el-input
                v-model="descriptionItems[idx]"
                placeholder="请输入一条说明"
                clearable
              />
              <el-button class="desc-remove" type="danger" link @click="removeDescriptionItem(idx)">删除</el-button>
            </div>

            <button type="button" class="desc-add" @click="addDescriptionItem">
              + 添加说明
            </button>
            <div class="form-tip">提示：每条说明会按行保存（提交时自动合并）。</div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 题目配置弹窗 -->
    <el-dialog v-model="questionDialogVisible" :title="'题目配置 - ' + (questionDialogExam ? questionDialogExam.name : '')" width="1000px">
      <div v-loading="questionDialogLoading" class="qcfg">
        <el-row :gutter="16">
          <el-col :span="12">
            <div class="qcfg-card">
              <div class="qcfg-title">
                题库选择 <span class="qcfg-sub">(仅显示未分配题目)</span>
                <el-button type="primary" size="small" style="float: right" :disabled="bankSelected.length === 0" @click="addFromBank">
                  添加到已选
                </el-button>
              </div>
              <div class="qcfg-filter">
                <el-select v-model="bankQuery.category" placeholder="分类" clearable style="width: 160px">
                  <el-option
                    v-for="cat in bankCategories"
                    :key="cat"
                    :label="cat"
                    :value="cat"
                  />
                </el-select>
                <el-select v-model="bankQuery.type" placeholder="题型" clearable style="width: 160px">
                  <el-option
                    v-for="type in bankTypes"
                    :key="type"
                    :label="type"
                    :value="type"
                  />
                </el-select>
                <el-button type="primary" @click="bankQuery.page = 1; loadBank()">查询</el-button>
              </div>
              <el-table
                v-loading="bankLoading"
                :data="bankList"
                height="360"
                border
                @selection-change="onBankSelectionChange"
              >
                <el-table-column type="selection" width="45" />
                <el-table-column prop="content" label="题目" min-width="220" show-overflow-tooltip />
                <el-table-column prop="category" label="分类" width="90" />
                <el-table-column prop="type" label="题型" width="90" />
              </el-table>
              <div class="qcfg-pagination">
                <el-pagination
                  background
                  layout="prev, pager, next"
                  :total="bankTotal"
                  :current-page="bankQuery.page"
                  :page-size="bankQuery.pageSize"
                  :pager-count="3"
                  @current-change="onBankPageChange"
                />
              </div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="qcfg-card">
              <div class="qcfg-title">
                已选题目 
                <span class="qcfg-sub" :class="{ 'qcfg-warning': questionDialogExam && selectedInExam.length > (questionDialogExam.questionCount || 0) }">
                  ({{ selectedInExam.length }} / {{ questionDialogExam ? (questionDialogExam.questionCount || 0) : 0 }} 道)
                </span>
                <el-button type="primary" size="small" style="float: right" @click="autoSelectQuestions">
                  自动抽题
                </el-button>
              </div>
              <div class="qcfg-filter">
                <el-select v-model="selectedFilter.category" placeholder="分类" clearable style="width: 160px">
                  <el-option
                    v-for="cat in bankCategories"
                    :key="cat"
                    :label="cat"
                    :value="cat"
                  />
                </el-select>
                <el-select v-model="selectedFilter.type" placeholder="题型" clearable style="width: 160px">
                  <el-option
                    v-for="type in bankTypes"
                    :key="type"
                    :label="type"
                    :value="type"
                  />
                </el-select>
                <el-button type="primary" @click="selectedPagination.currentPage = 1">查询</el-button>
              </div>
              <el-table :data="paginatedSelectedInExam" height="360" border>
                <el-table-column prop="content" label="题目" min-width="220" show-overflow-tooltip />
                <el-table-column prop="category" label="分类" width="90" />
                <el-table-column prop="type" label="题型" width="90" />
                <el-table-column label="操作" width="70">
                  <template #default="{ row }">
                    <el-button type="danger" link size="small" @click="removeFromExam(row)">移除</el-button>
                  </template>
                </el-table-column>
              </el-table>
              <div class="qcfg-pagination">
                <el-pagination
                  background
                  layout="prev, pager, next"
                  :total="selectedTotal"
                  :current-page="selectedPagination.currentPage"
                  :page-size="selectedPagination.pageSize"
                  :pager-count="3"
                  @current-change="onSelectedPageChange"
                />
              </div>
            </div>
          </el-col>
        </el-row>
      </div>
      <template #footer>
        <el-button @click="questionDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="questionDialogSaving" @click="saveQuestionConfig">保存</el-button>
      </template>
    </el-dialog>

    <!-- 发布范围弹窗 -->
    <el-dialog v-model="publishDialogVisible" :title="'发布范围 - ' + (currentExam ? currentExam.name : '')" width="700px">
      <el-alert title="不设置任何范围表示对所有用户发布" type="info" show-icon :closable="false" style="margin-bottom: 20px;" />

      <el-table :data="assignments" stripe border max-height="300px">
        <el-table-column prop="department" label="院系" />
        <el-table-column prop="class" label="班级">
          <template #default="{ row }">
            {{ row.class || '（全体）' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ $index }">
            <el-button type="danger" link size="small" @click="removeAssignment($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-form :model="newAssignment" class="publish-filter">
        <el-form-item label="院系">
          <el-select
            v-model="newAssignment.department"
            placeholder="请选择院系"
            clearable
            style="width: 220px"
          >
            <el-option
              v-for="d in publishDepartments"
              :key="d.id"
              :label="d.name"
              :value="d.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="班级">
          <el-select
            v-model="newAssignment.classes"
            multiple
            filterable
            placeholder="（可选）具体班级，可多选"
            style="width: 220px"
          >
            <el-option
              v-for="c in publishClassOptions"
              :key="c.id"
              :label="c.name"
              :value="c.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="addAssignment">添加范围</el-button>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="publishDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveAssignments">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.exams-page {
  .search-form {
    .el-form-item {
      margin-bottom: 0;
    }
  }

  .op-col {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
  }

  .op-col :deep(.el-button) {
    margin-left: 0 !important;
  }

  .form-tip {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.2;
    color: #909399;
  }

  .desc-list {
    width: 100%;
  }

  .desc-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .desc-row :deep(.el-input) {
    flex: 1 1 auto;
  }

  .desc-row :deep(.el-input__wrapper) {
    height: 32px;
    align-items: center;
  }

  .desc-row :deep(.el-input__inner) {
    height: 32px;
    line-height: 32px;
  }

  .desc-remove {
    flex: 0 0 auto;
    height: 32px;
    padding: 0 6px;
    display: inline-flex;
    align-items: center;
  }

  .desc-add {
    width: 90%;
    height: 32px;
    border: 1px dashed var(--el-border-color);
    border-radius: 8px;
    background: var(--el-fill-color-lighter);
    color: var(--el-text-color-regular);
    cursor: pointer;
    font-size: 14px;
    line-height: 32px;
    text-align: center;
    transition: all 0.15s ease;
  }

  .desc-add:hover {
    border-color: var(--el-color-primary);
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  .qcfg-card {
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
    padding: 12px;
    background: #fff;
  }

  .qcfg-title {
    font-weight: 600;
    margin-bottom: 10px;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .qcfg-sub {
    color: #909399;
    font-size: 12px;
    font-weight: 400;
  }

  .qcfg-warning {
    color: #f56c6c !important;
    font-weight: 600;
  }

  .qcfg-filter {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }

  .qcfg-actions {
    margin-bottom: 10px;
  }

  .qcfg-pagination {
    margin-top: 10px;
    display: flex;
    justify-content: center;
  }

  .pagination-wrapper {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }

  .qcfg-tip {
    margin-top: 10px;
    font-size: 12px;
    color: #909399;
  }

  .publish-filter {
    margin-top: 20px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  .publish-filter :deep(.el-form-item) {
    margin-bottom: 0;
  }
}
</style>
