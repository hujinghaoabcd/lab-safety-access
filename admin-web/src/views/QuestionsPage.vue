<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { InfoFilled, Delete, Plus, Upload, Document, UploadFilled, Download } from '@element-plus/icons-vue'
import * as adminApi from '@/api/admin'

interface Question {
  id: number
  content: string
  type: string
  category: string
  options: string[]
  answer: string
  analysis: string
  createTime: string
}

const questions = ref<Question[]>([])
const selectedQuestions = ref<Question[]>([])
const tableRef = ref()
const loading = ref(false)
const categories = ['通用安全','化学安全', '生物安全', '辐射安全', '电气安全','消防安全']
const types = ['单选题', '多选题', '判断题']

const searchForm = reactive({
  keyword: '',
  category: '',
  type: ''
})

const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 0
})

const dialogVisible = ref(false)
const dialogTitle = ref('添加题目')
const formRef = ref()
const questionForm = reactive({
  id: 0,
  content: '',
  type: '单选题',
  category: '',
  options: ['A. ', 'B. ', 'C. ', 'D. '],
  answer: '',
  analysis: ''
})

const rules = {
  content: [{ required: true, message: '请输入题目内容', trigger: 'blur' }],
  type: [{ required: true, message: '请选择题目类型', trigger: 'change' }],
  category: [{ required: true, message: '请选择题目分类', trigger: 'change' }],
  answer: [{ required: true, message: '请输入正确答案', trigger: 'blur' }]
}

// 加载题目列表
const loadQuestions = async () => {
  loading.value = true
  try {
    const params: any = {
      page: pagination.currentPage,
      pageSize: pagination.pageSize
    }
    if (searchForm.keyword) params.keyword = searchForm.keyword
    if (searchForm.category) params.category = searchForm.category
    if (searchForm.type) params.type = searchForm.type

    const data = await adminApi.getQuestions(params)
    console.log('获取到的数据:', data) // 调试用
    
    // 兼容两种数据格式：数组格式（旧版）和对象格式（新版带分页）
    if (Array.isArray(data)) {
      // 如果是数组，说明是旧格式，没有分页
      questions.value = data || []
      pagination.total = data?.length || 0
    } else {
      // 如果是对象，说明是新格式，有分页
      questions.value = data?.list || []
      pagination.total = data?.total || 0
    }
    console.log('题目列表:', questions.value.length, '总数:', pagination.total) // 调试用
  } catch (err) {
    console.error('加载题目列表失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadQuestions()
})

const handleSearch = () => {
  pagination.currentPage = 1
  loadQuestions()
}

const handleReset = () => {
  searchForm.keyword = ''
  searchForm.category = ''
  searchForm.type = ''
  pagination.currentPage = 1
  loadQuestions()
}

const handleAdd = () => {
  dialogTitle.value = '添加题目'
  Object.assign(questionForm, { id: 0, content: '', type: '单选题', category: '', options: ['A. ', 'B. ', 'C. ', 'D. '], answer: '', analysis: '' })
  dialogVisible.value = true
}

const handleEdit = (row: Question) => {
  dialogTitle.value = '编辑题目'
  Object.assign(questionForm, row)
  dialogVisible.value = true
}

const handleDelete = async (row: Question) => {
  try {
    await ElMessageBox.confirm('确定要删除这道题目吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await adminApi.deleteQuestion(row.id)
    ElMessage.success('删除成功')
    
    // 如果当前页没有数据了，回到上一页
    if (questions.value.length === 1 && pagination.currentPage > 1) {
      pagination.currentPage--
    }
    loadQuestions()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '删除失败')
    }
  }
}

const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    if (questionForm.id) {
      await adminApi.updateQuestion(questionForm.id, {
        content: questionForm.content,
        type: questionForm.type,
        category: questionForm.category,
        options: questionForm.options,
        answer: questionForm.answer,
        analysis: questionForm.analysis
      })
      ElMessage.success('编辑成功')
    } else {
      await adminApi.createQuestion({
        content: questionForm.content,
        type: questionForm.type,
        category: questionForm.category,
        options: questionForm.options,
        answer: questionForm.answer,
        analysis: questionForm.analysis
      })
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    // 如果是新增，回到第一页；如果是编辑，保持当前页
    if (!questionForm.id) {
      pagination.currentPage = 1
    }
    loadQuestions()
  } catch (err: any) {
    ElMessage.error(err.message || '操作失败')
  }
}

const handleTypeChange = (type: string) => {
  if (type === '判断题') {
    questionForm.options = ['正确', '错误']
  } else {
    questionForm.options = ['A. ', 'B. ', 'C. ', 'D. ']
  }
  questionForm.answer = ''
}

const addOption = () => {
  const letter = String.fromCharCode(65 + questionForm.options.length)
  questionForm.options.push(`${letter}. `)
}

const removeOption = (index: number) => {
  if (questionForm.options.length > 2) {
    questionForm.options.splice(index, 1)
  }
}

// 批量导入
const importDialogVisible = ref(false)
const importFile = ref<File | null>(null)
const importLoading = ref(false)
const exportLoading = ref(false)

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
    const formData = new FormData()
    formData.append('file', importFile.value)
    
    const result = await adminApi.importQuestions(formData)
    console.log('导入结果:', result) // 调试用
    console.log('导入结果类型:', typeof result, '是否为数组:', Array.isArray(result)) // 调试用
    console.log('导入结果键:', result ? Object.keys(result) : 'null') // 调试用
    
    // 兼容多种返回格式
    let successCount = 0
    let failedCount = 0
    let errors = []
    
    if (result) {
      if (result.success !== undefined) {
        // 新格式: {success, failed, errors}
        successCount = result.success || 0
        failedCount = result.failed || 0
        errors = result.errors || []
      } else if (result.imported !== undefined) {
        // 旧格式: {imported: 10}
        successCount = result.imported || 0
        failedCount = 0
        errors = []
      } else if (Array.isArray(result)) {
        // 数组格式
        successCount = result.length || 0
        failedCount = 0
        errors = []
      }
    }

    // 显示错误信息
    if (failedCount > 0 && errors && errors.length > 0) {
      const errorMsg = errors.slice(0, 20).join('\n') + (errors.length > 20 ? `\n...还有 ${errors.length - 20} 条错误` : '')
      ElMessageBox.alert(errorMsg, '导入错误', {
        type: 'warning',
        confirmButtonText: '确定'
      })
    }

    // 显示成功消息
    let successMsg = `导入完成: 成功 ${successCount} 条`
    if (failedCount > 0) {
      successMsg += `, 失败 ${failedCount} 条`
    }
    ElMessage.success(successMsg)
    
    importDialogVisible.value = false
    importFile.value = null
    pagination.currentPage = 1
    loadQuestions()
  } catch (err: any) {
    console.error('导入错误:', err) // 调试用
    ElMessage.error(err.message || '导入失败')
  } finally {
    importLoading.value = false
  }
}

// 分页变化
const handlePageChange = (page: number) => {
  pagination.currentPage = page
  loadQuestions()
}

const handlePageSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.currentPage = 1
  loadQuestions()
}

// 多选与批量删除
const handleSelectionChange = (selection: Question[]) => {
  selectedQuestions.value = selection
}

const handleBatchDelete = async () => {
  if (selectedQuestions.value.length === 0) return
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedQuestions.value.length} 条题目吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const ids = selectedQuestions.value.map(q => q.id)
    const res = await adminApi.batchDeleteQuestions(ids)
    const deleted = res?.deleted ?? ids.length
    ElMessage.success(`已删除 ${deleted} 条题目`)

    // 若当前页数据被删光，自动回到上一页
    if (questions.value.length === selectedQuestions.value.length && pagination.currentPage > 1) {
      pagination.currentPage--
    }
    selectedQuestions.value = []
    // 清空表格勾选
    tableRef.value?.clearSelection?.()
    loadQuestions()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '批量删除失败')
    }
  }
}

// 导出全部
const handleExportAll = async () => {
  exportLoading.value = true
  try {
    const res = await adminApi.exportQuestions()
    const fileName = res?.fileName || `题库导出_${new Date().toISOString().slice(0,10)}.xlsx`
    const base64 = res?.base64
    if (!base64) {
      ElMessage.warning('没有可导出的数据')
      return
    }
    const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    const link = document.createElement('a')
    link.href = `data:${mime};base64,${base64}`
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    ElMessage.success('导出成功')
  } catch (err: any) {
    ElMessage.error(err.message || '导出失败')
  } finally {
    exportLoading.value = false
  }
}
</script>

<template>
  <div class="questions-page">
    <!-- 搜索栏 -->
    <div class="page-card">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="题目内容" clearable />
        </el-form-item>
        <el-form-item label="分类">
          <el-select 
            v-model="searchForm.category" 
            placeholder="请选择分类" 
            clearable 
            style="width: 150px"
            @change="handleSearch"
          >
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="题型">
          <el-select 
            v-model="searchForm.type" 
            placeholder="请选择题型" 
            clearable 
            style="width: 150px"
            @change="handleSearch"
          >
            <el-option v-for="t in types" :key="t" :label="t" :value="t" />
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
        <h2>题库列表</h2>
        <div>
          <el-button type="warning" :loading="exportLoading" @click="handleExportAll" style="margin-right: 8px;">
            <el-icon><Download /></el-icon>
            导出全部
          </el-button>
          <el-button type="danger" :disabled="selectedQuestions.length === 0" @click="handleBatchDelete" style="margin-right: 8px;">
            <el-icon><Delete /></el-icon>
            批量删除
          </el-button>
          <el-button type="success" @click="handleImport" style="margin-right: 8px;">
            <el-icon><Upload /></el-icon>
            批量导入
          </el-button>
          <el-button type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            添加题目
          </el-button>
        </div>
      </div>

      <el-table ref="tableRef" v-loading="loading" :data="questions" stripe border @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" />
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="content" label="题目内容" min-width="300" show-overflow-tooltip />
        <el-table-column prop="type" label="题型" width="100">
          <template #default="{ row }">
            <el-tag 
              :type="row.type === '单选题' ? 'primary' : row.type === '多选题' ? 'warning' : 'success'" 
              size="small"
            >
              {{ row.type }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="100" />
        <el-table-column prop="answer" label="答案" width="80" />
        <el-table-column prop="createTime" label="创建时间" width="170" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
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
          @current-change="handlePageChange" 
          @size-change="handlePageSizeChange" 
        />
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="700px" class="question-dialog">
      <el-form ref="formRef" :model="questionForm" :rules="rules" label-width="100px" class="question-form">
        <el-form-item label="题目内容" prop="content">
          <el-input v-model="questionForm.content" type="textarea" :rows="3" placeholder="请输入题目内容" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="题目类型" prop="type">
              <el-select v-model="questionForm.type" style="width: 100%" @change="handleTypeChange">
                <el-option v-for="t in types" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="题目分类" prop="category">
              <el-select v-model="questionForm.category" style="width: 100%">
                <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="题目选项">
          <div class="options-list">
            <div v-for="(_, index) in questionForm.options" :key="index" class="option-item">
              <span class="option-letter">{{ String.fromCharCode(65 + index) }}</span>
              <el-input v-model="questionForm.options[index]" placeholder="请输入选项内容" class="option-input" />
              <el-button 
                v-if="questionForm.type !== '判断题' && questionForm.options.length > 2" 
                type="danger" 
                plain
                size="small"
                class="option-delete-btn"
                @click="removeOption(index)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
              <span v-else class="option-placeholder"></span>
            </div>
            <div 
              v-if="questionForm.type !== '判断题'" 
              class="add-option-btn"
              @click="addOption"
              style="display: flex; align-items: center; height: 32px; margin-left: 34px; margin-top: 4px;"
            >
              <el-button 
                type="primary" 
                link 
                style="padding: 0; height: 32px; display: flex; align-items: center;"
              >
                <el-icon class="add-icon" style="margin-right: 4px;"><Plus /></el-icon>
                <span>添加选项</span>
              </el-button>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="正确答案" prop="answer">
          <el-input v-model="questionForm.answer" placeholder="如：A 或 ABC 或 正确/错误" />
          <div class="answer-tip">
            <el-icon><InfoFilled /></el-icon>
            <span>单选题填单个字母（如：A），多选题填多个字母（如：ABC），判断题填"正确"或"错误"</span>
          </div>
        </el-form-item>
        <el-form-item label="答案解析">
          <el-input v-model="questionForm.analysis" type="textarea" :rows="2" placeholder="请输入答案解析" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 批量导入弹窗 -->
    <el-dialog v-model="importDialogVisible" title="批量导入题目" width="600px">
      <div class="import-guide">
        <div class="guide-header">
          <el-icon class="guide-icon"><Document /></el-icon>
          <span class="guide-title">Excel 格式说明</span>
        </div>
        <div class="guide-content">
          <div class="guide-item">
            <el-icon class="item-icon"><InfoFilled /></el-icon>
            <div class="item-text">
              <strong>列名要求：</strong>题目内容、题目类型、题目分类、选项、正确答案、答案解析（可选）
            </div>
          </div>
          <!-- <div class="guide-item">
            <el-icon class="item-icon"><InfoFilled /></el-icon>
            <div class="item-text">
              <strong>格式要求：</strong>第一行为表头，从第二行开始为数据
            </div>
          </div> -->
          <div class="guide-item">
            <el-icon class="item-icon"><InfoFilled /></el-icon>
            <div class="item-text">
              <strong>题目类型：</strong>必须是"单选题"、"多选题"或"判断题"
            </div>
          </div>
          <div class="guide-item">
            <el-icon class="item-icon"><InfoFilled /></el-icon>
            <div class="item-text">
              <strong>选项格式：</strong>使用 | 分隔，如 "A.选项1|B.选项2|C.选项3|D.选项4"，或分别填写"选项A"、"选项B"等列
            </div>
          </div>
          <div class="guide-item">
            <el-icon class="item-icon"><InfoFilled /></el-icon>
            <div class="item-text">
              <strong>正确答案：</strong>单选题填单个字母（如：A），多选题填多个字母（如：ABC），判断题填"正确"或"错误"
            </div>
          </div>
          <div class="guide-example">
            <div class="example-title">示例格式：</div>
            <div class="example-table">
              <table>
                <thead>
                  <tr>
                    <th>题目内容</th>
                    <th>题目类型</th>
                    <th>题目分类</th>
                    <th>选项</th>
                    <th>正确答案</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>实验室安全的基本原则是什么？</td>
                    <td>单选题</td>
                    <td>通用安全</td>
                    <td>A.安全第一|B.效率优先|C.成本控制|D.随意操作</td>
                    <td>A</td>
                  </tr>
                  <tr>
                    <td>以下哪些是实验室常见危险？</td>
                    <td>多选题</td>
                    <td>通用安全</td>
                    <td>A.火灾|B.爆炸|C.中毒|D.辐射</td>
                    <td>ABCD</td>
                  </tr>
                  <tr>
                    <td>实验室操作时必须佩戴防护用品</td>
                    <td>判断题</td>
                    <td>通用安全</td>
                    <td>正确|错误</td>
                    <td>正确</td>
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
          <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
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
.questions-page {
  .search-form {
    .el-form-item {
      margin-bottom: 0;
    }
  }
  
  /* 对话框样式 */
  :deep(.question-dialog) {
    .el-dialog__body {
      padding: 20px;
    }
  }

  .question-form {
    :deep(.el-form-item) {
      margin-bottom: 20px;
    }

    :deep(.el-form-item__label) {
      font-weight: 500;
    }
  }

  .options-list {
    width: 100%;

    .option-item {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;

      .option-letter {
        width: 28px;
        height: 28px;
        line-height: 28px;
        text-align: center;
        // border-radius: 50%;
        background: #ecf5ff;
        color: #409eff;
        font-weight: 600;
        font-size: 13px;
        border: 1px solid #c6e2ff;
        flex-shrink: 0;
      }

      .option-input {
        flex: 1;
        min-width: 0;
      }

      .option-delete-btn {
        width: 28px;
        height: 28px;
        flex-shrink: 0;
        padding: 0;
      }

      .option-placeholder {
        width: 28px;
        height: 28px;
        flex-shrink: 0;
      }
    }

    .add-option-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 87%;
      height: 40px;
      margin-top: 4px;
      padding: 0;
      background: #fff;
      border: 1px dashed #dcdfe6;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.3s;
      color: #409eff;
      font-size: 14px;

      &:hover {
        border-color: #409eff;
        background: #f0f9ff;
      }

      .add-icon {
        font-size: 16px;
      }
    }
  }

  .answer-tip {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-top: 8px;
    padding: 8px 12px;
    border-radius: 4px;
    background: #f0f9ff;
    border: 1px solid #c6e2ff;
    color: #606266;
    font-size: 12px;
    line-height: 1.6;

    .el-icon {
      color: #409eff;
      margin-top: 2px;
      flex-shrink: 0;
    }
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
                border: 1px solid #409eff;
                white-space: nowrap;
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

  .pagination-wrapper {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
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
          }
        }
      }

      .el-upload__tip {
        text-align: center;
        color: #909399;
        font-size: 12px;
        margin-top: 8px;
      }
    }
  }
}
</style>

