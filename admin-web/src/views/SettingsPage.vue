<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Upload, UploadFilled } from '@element-plus/icons-vue'
import * as adminApi from '@/api/admin'

// 基本设置
const basicForm = reactive({
  siteName: '实验室安全教育考试系统',
  siteDesc: '中国科学院大学生命科学学院实验室安全教育考试平台',
  adminEmail: 'admin@ucas.ac.cn',
  recordNo: '京ICP备XXXXXXXX号'
})

// 证书设置
const certForm = reactive({
  issuer: '中国科学院大学生命科学学院',
  validDays: 365,
  autoIssue: true
})

// 安全设置
const securityForm = reactive({
  loginAttempts: 5,
  lockDuration: 30,
  passwordMinLength: 6,
  passwordComplexity: false,
  sessionTimeout: 120
})
// 联系方式设置
const contactForm = reactive({
  phone: '010-12345678',
  email: 'lab-safety@ucas.edu.cn',
  address: '中国科学院大学玉泉路校区'
})

// 跑马灯管理
interface Banner {
  id: number
  title: string
  subtitle: string
  color: string
  orderNum: number
  status: number
}

const banners = ref<Banner[]>([])
const bannerLoading = ref(false)
const bannerDialogVisible = ref(false)
const bannerDialogTitle = ref('新增跑马灯')
const bannerFormRef = ref()
const bannerForm = reactive({
  id: 0,
  title: '',
  subtitle: '',
  color: '#0475FA',
  orderNum: 0,
  status: 1
})

// 公告管理
interface Announcement {
  id: number
  content: string
  orderNum: number
  status: number
}

const announcements = ref<Announcement[]>([])
const announcementLoading = ref(false)
const announcementDialogVisible = ref(false)
const announcementDialogTitle = ref('新增公告')
const announcementFormRef = ref()
const announcementForm = reactive({
  id: 0,
  content: '',
  orderNum: 0,
  status: 1
})

// 初始化加载系统设置
onMounted(async () => {
  try {
    const res: any = await adminApi.getSettings()
    const data = res?.data || res

    if (data?.basic) {
      Object.assign(basicForm, data.basic)
    }
    if (data?.cert) {
      Object.assign(certForm, data.cert)
    }
    if (data?.security) {
      Object.assign(securityForm, data.security)
    }
    if (data?.contact) {
      Object.assign(contactForm, data.contact)
    }
  } catch (err) {
    console.error('加载系统设置失败:', err)
  }
  
  // 加载跑马灯和公告列表
  loadBanners()
  loadAnnouncements()
})

// 跑马灯管理方法
const loadBanners = async () => {
  bannerLoading.value = true
  try {
    const data: any = await adminApi.getBanners({ page: 1, pageSize: 100 })
    banners.value = data.list || []
  } catch (err: any) {
    ElMessage.error(err?.message || '加载跑马灯列表失败')
  } finally {
    bannerLoading.value = false
  }
}

const handleAddBanner = () => {
  bannerDialogTitle.value = '新增跑马灯'
  Object.assign(bannerForm, {
    id: 0,
    title: '',
    subtitle: '',
    color: '#0475FA',
    orderNum: 0,
    status: 1
  })
  bannerDialogVisible.value = true
}

const handleEditBanner = (row: Banner) => {
  bannerDialogTitle.value = '编辑跑马灯'
  Object.assign(bannerForm, {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    color: row.color,
    orderNum: row.orderNum,
    status: row.status
  })
  bannerDialogVisible.value = true
}

const handleDeleteBanner = async (row: Banner) => {
  try {
    await ElMessageBox.confirm(`确定要删除跑马灯"${row.title}"吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await adminApi.deleteBanner(row.id)
    ElMessage.success('删除成功')
    loadBanners()
  } catch (err: any) {
    if (err === 'cancel') return
    ElMessage.error(err?.message || '删除失败')
  }
}

const handleSubmitBanner = async () => {
  try {
    await bannerFormRef.value.validate()
    if (bannerForm.id) {
      await adminApi.updateBanner(bannerForm.id, bannerForm)
      ElMessage.success('更新成功')
    } else {
      await adminApi.createBanner(bannerForm)
      ElMessage.success('创建成功')
    }
    bannerDialogVisible.value = false
    loadBanners()
  } catch (err: any) {
    if (err === false) return
    ElMessage.error(err?.message || '操作失败')
  }
}

const handleBannerStatusChange = async (row: Banner) => {
  try {
    await adminApi.updateBanner(row.id, { status: row.status })
    ElMessage.success('状态更新成功')
  } catch (err: any) {
    ElMessage.error(err?.message || '状态更新失败')
    loadBanners()
  }
}

// 公告管理方法
const loadAnnouncements = async () => {
  announcementLoading.value = true
  try {
    const data: any = await adminApi.getAnnouncements({ page: 1, pageSize: 100 })
    announcements.value = data.list || []
  } catch (err: any) {
    ElMessage.error(err?.message || '加载公告列表失败')
  } finally {
    announcementLoading.value = false
  }
}

const handleAddAnnouncement = () => {
  announcementDialogTitle.value = '新增公告'
  Object.assign(announcementForm, {
    id: 0,
    content: '',
    orderNum: 0,
    status: 1
  })
  announcementDialogVisible.value = true
}

const handleEditAnnouncement = (row: Announcement) => {
  announcementDialogTitle.value = '编辑公告'
  Object.assign(announcementForm, {
    id: row.id,
    content: row.content,
    orderNum: row.orderNum,
    status: row.status
  })
  announcementDialogVisible.value = true
}

const handleDeleteAnnouncement = async (row: Announcement) => {
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

const handleSubmitAnnouncement = async () => {
  try {
    await announcementFormRef.value.validate()
    if (announcementForm.id) {
      await adminApi.updateAnnouncement(announcementForm.id, announcementForm)
      ElMessage.success('更新成功')
    } else {
      await adminApi.createAnnouncement(announcementForm)
      ElMessage.success('创建成功')
    }
    announcementDialogVisible.value = false
    loadAnnouncements()
  } catch (err: any) {
    if (err === false) return
    ElMessage.error(err?.message || '操作失败')
  }
}

const handleAnnouncementStatusChange = async (row: Announcement) => {
  try {
    await adminApi.updateAnnouncement(row.id, { status: row.status })
    ElMessage.success('状态更新成功')
  } catch (err: any) {
    ElMessage.error(err?.message || '状态更新失败')
    loadAnnouncements()
  }
}

const handleSaveBasic = async () => {
  try {
    await adminApi.updateSettings('basic', basicForm)
    ElMessage.success('基本设置保存成功')
  } catch (err: any) {
    console.error('保存基本设置失败:', err)
    ElMessage.error(err?.message || '保存基本设置失败')
  }
}

const handleSaveCert = async () => {
  try {
    await adminApi.updateSettings('cert', certForm)
    ElMessage.success('证书设置保存成功')
  } catch (err: any) {
    console.error('保存证书设置失败:', err)
    ElMessage.error(err?.message || '保存证书设置失败')
  }
}

const handleSaveSecurity = async () => {
  try {
    await adminApi.updateSettings('security', securityForm)
    ElMessage.success('安全设置保存成功')
  } catch (err: any) {
    console.error('保存安全设置失败:', err)
    ElMessage.error(err?.message || '保存安全设置失败')
  }
}

const handleSaveContact = async () => {
  try {
    await adminApi.updateSettings('contact', contactForm)
    ElMessage.success('联系方式保存成功')
  } catch (err: any) {
    console.error('保存联系方式失败:', err)
    ElMessage.error(err?.message || '保存联系方式失败')
  }
}

// 数据库维护
const restoreFile = ref<any>(null)

const handleBackupAndClear = async () => {
  try {
    await ElMessageBox.confirm(
      '此操作将备份当前数据库并清空所有业务数据（保留院系/班级和表结构），请确认已知晓后再继续。',
      '危险操作确认',
      {
        confirmButtonText: '是的，执行清空',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    const data: any = await adminApi.backupAndClearDb()
    const downloadUrl = data?.downloadUrl
    ElMessage.success('数据库已备份并清空业务数据')
    if (downloadUrl) {
      // 通过前端代理访问备份文件，直接触发浏览器下载
      window.open(downloadUrl, '_blank')
    }
  } catch (err: any) {
    if (err === 'cancel') return
    console.error('备份并清空数据库失败:', err)
    ElMessage.error(err?.message || '备份并清空数据库失败')
  }
}

const handleRestoreFileChange = (file: any) => {
  restoreFile.value = file.raw || file
}

const handleRestoreDb = async () => {
  if (!restoreFile.value) {
    ElMessage.warning('请先选择要恢复的数据库文件')
    return
  }
  try {
    await ElMessageBox.confirm(
      '此操作将用上传的数据库文件覆盖当前数据库，操作完成后需要重启后端服务生效，是否继续？',
      '危险操作确认',
      {
        confirmButtonText: '是的，执行恢复',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    const file = restoreFile.value.raw || restoreFile.value
    await adminApi.restoreDb(file)
    ElMessage.success('数据库恢复文件上传成功，请重启后端服务')
    restoreFile.value = null // 清空文件选择
  } catch (err: any) {
    if (err === 'cancel') return
    console.error('恢复数据库失败:', err)
    ElMessage.error(err?.message || '恢复数据库失败')
  }
}

// 当前激活的tab
const activeTab = ref('basic')
</script>

<template>
  <div class="settings-page">
    <el-tabs v-model="activeTab" type="border-card">
      <!-- 基本设置 -->
      <el-tab-pane label="基本设置" name="basic">
        <el-form :model="basicForm" label-width="120px" style="max-width: 600px">
          <el-form-item label="系统名称">
            <el-input v-model="basicForm.siteName" />
          </el-form-item>
          <el-form-item label="系统描述">
            <el-input v-model="basicForm.siteDesc" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="管理员邮箱">
            <el-input v-model="basicForm.adminEmail" />
          </el-form-item>
          <el-form-item label="备案号">
            <el-input v-model="basicForm.recordNo" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleSaveBasic">保存设置</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 证书设置 -->
      <el-tab-pane label="证书设置" name="cert">
        <el-form :model="certForm" label-width="140px" style="max-width: 600px">
          <el-form-item label="发证单位">
            <el-input v-model="certForm.issuer" />
          </el-form-item>
          <el-form-item label="证书有效期">
            <el-input-number v-model="certForm.validDays" :min="30" :max="3650" />
            <span class="form-tip">天</span>
          </el-form-item>
          <el-form-item label="自动发放证书">
            <el-switch v-model="certForm.autoIssue" />
            <span class="form-tip">考试通过后自动发放证书</span>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleSaveCert">保存设置</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 安全设置 -->
      <el-tab-pane label="安全设置" name="security">
        <el-form :model="securityForm" label-width="140px" style="max-width: 600px">
          <el-form-item label="登录失败上限">
            <el-input-number v-model="securityForm.loginAttempts" :min="3" :max="10" />
            <span class="form-tip">次</span>
          </el-form-item>
          <el-form-item label="账号锁定时长">
            <el-input-number v-model="securityForm.lockDuration" :min="5" :max="1440" />
            <span class="form-tip">分钟</span>
          </el-form-item>
          <el-form-item label="密码最小长度">
            <el-input-number v-model="securityForm.passwordMinLength" :min="4" :max="20" />
            <span class="form-tip">位</span>
          </el-form-item>
          <el-form-item label="密码复杂度要求">
            <el-switch v-model="securityForm.passwordComplexity" />
            <span class="form-tip">需包含数字、字母和特殊字符</span>
          </el-form-item>
          <el-form-item label="会话超时时间">
            <el-input-number v-model="securityForm.sessionTimeout" :min="10" :max="1440" />
            <span class="form-tip">分钟</span>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleSaveSecurity">保存设置</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 联系方式 -->
      <el-tab-pane label="联系方式" name="contact">
        <el-form :model="contactForm" label-width="140px" style="max-width: 600px">
          <el-form-item label="咨询电话">
            <el-input v-model="contactForm.phone" placeholder="如：010-12345678" />
          </el-form-item>
          <el-form-item label="电子邮箱">
            <el-input v-model="contactForm.email" placeholder="如：lab-safety@ucas.edu.cn" />
          </el-form-item>
          <el-form-item label="工作地点">
            <el-input v-model="contactForm.address" placeholder="如：中国科学院大学玉泉路校区" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleSaveContact">保存设置</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 跑马灯管理 -->
      <el-tab-pane label="跑马灯管理" name="banners">
        <div style="margin-bottom: 20px">
          <el-button type="primary" :icon="Plus" @click="handleAddBanner">新增跑马灯</el-button>
        </div>
        <el-table v-loading="bannerLoading" :data="banners" stripe border>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="title" label="标题" min-width="150" />
          <el-table-column prop="subtitle" label="副标题" min-width="150" />
          <el-table-column prop="color" label="颜色" width="120">
            <template #default="{ row }">
              <div style="display: flex; align-items: center; gap: 8px">
                <div
                  :style="{
                    width: '30px',
                    height: '30px',
                    backgroundColor: row.color,
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }"
                />
                <span>{{ row.color }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="orderNum" label="排序" width="80" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-switch
                v-model="row.status"
                :active-value="1"
                :inactive-value="0"
                @change="handleBannerStatusChange(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" :icon="Edit" @click="handleEditBanner(row)">
                编辑
              </el-button>
              <el-button type="danger" link size="small" :icon="Delete" @click="handleDeleteBanner(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 公告管理 -->
      <el-tab-pane label="公告管理" name="announcements">
        <div style="margin-bottom: 20px">
          <el-button type="primary" :icon="Plus" @click="handleAddAnnouncement">新增公告</el-button>
        </div>
        <el-table v-loading="announcementLoading" :data="announcements" stripe border>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="content" label="公告内容" min-width="300" show-overflow-tooltip />
          <el-table-column prop="orderNum" label="排序" width="80" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-switch
                v-model="row.status"
                :active-value="1"
                :inactive-value="0"
                @change="handleAnnouncementStatusChange(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" :icon="Edit" @click="handleEditAnnouncement(row)">
                编辑
              </el-button>
              <el-button type="danger" link size="small" :icon="Delete" @click="handleDeleteAnnouncement(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 数据维护（仅超级管理员使用） -->
      <el-tab-pane label="数据维护" name="maintenance">
        <div class="danger-block">
          <h3>数据库备份与清空</h3>
          <p class="form-tip">
            此操作将自动备份当前数据库文件，并清空用户、考试、题库、考试记录、证书等业务数据（保留院系/班级和表结构）。
          </p>
          <el-button type="danger" @click="handleBackupAndClear">
            备份并清空数据库
          </el-button>
        </div>

        <div class="danger-block">
          <h3>从备份恢复数据库</h3>
          <p class="form-tip">
            请选择之前备份好的 SQLite 数据库文件（.db），上传后将覆盖当前数据库，操作完成后需要手动重启后端服务。
          </p>
          <el-upload
            :auto-upload="false"
            :on-change="handleRestoreFileChange"
            :on-remove="() => { restoreFile.value = null }"
            :file-list="restoreFile ? [{ name: (restoreFile.raw || restoreFile)?.name || '数据库文件.db', raw: restoreFile.raw || restoreFile }] : []"
            accept=".db"
            :limit="1"
            style="margin-top: 16px;"
          >
            <template #trigger>
              <el-button type="primary">
                <el-icon style="margin-right: 4px;"><Upload /></el-icon>
                选择数据库文件
              </el-button>
            </template>
            <template #tip>
              <div class="el-upload__tip" style="color: #909399; font-size: 12px; margin-top: 8px;">
                仅支持 .db 格式的 SQLite 数据库文件
              </div>
            </template>
          </el-upload>
          <el-button
            type="primary"
            style="margin-top: 16px;"
            :disabled="!restoreFile"
            @click="handleRestoreDb"
          >
            <el-icon style="margin-right: 4px;"><UploadFilled /></el-icon>
            上传并恢复数据库
          </el-button>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 跑马灯编辑对话框 -->
    <el-dialog v-model="bannerDialogVisible" :title="bannerDialogTitle" width="500px">
      <el-form ref="bannerFormRef" :model="bannerForm" label-width="100px">
        <el-form-item label="标题" prop="title" :rules="[{ required: true, message: '请输入标题' }]">
          <el-input v-model="bannerForm.title" placeholder="请输入标题" />
        </el-form-item>
        <el-form-item label="副标题" prop="subtitle">
          <el-input v-model="bannerForm.subtitle" placeholder="请输入副标题" />
        </el-form-item>
        <el-form-item label="颜色" prop="color">
          <el-color-picker v-model="bannerForm.color" />
        </el-form-item>
        <el-form-item label="排序" prop="orderNum">
          <el-input-number v-model="bannerForm.orderNum" :min="0" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-switch v-model="bannerForm.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bannerDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitBanner">确定</el-button>
      </template>
    </el-dialog>

    <!-- 公告编辑对话框 -->
    <el-dialog v-model="announcementDialogVisible" :title="announcementDialogTitle" width="600px">
      <el-form ref="announcementFormRef" :model="announcementForm" label-width="100px">
        <el-form-item
          label="公告内容"
          prop="content"
          :rules="[{ required: true, message: '请输入公告内容' }]"
        >
          <el-input
            v-model="announcementForm.content"
            type="textarea"
            :rows="4"
            placeholder="请输入公告内容"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="排序" prop="orderNum">
          <el-input-number v-model="announcementForm.orderNum" :min="0" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-switch v-model="announcementForm.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="announcementDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitAnnouncement">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.settings-page {
  .el-tabs {
    background: #fff;
    
    :deep(.el-tabs__content) {
      padding: 20px;
    }
  }
  
  .form-tip {
    margin-left: 10px;
    color: #909399;
    font-size: 12px;
  }

  .danger-block {
    margin-bottom: 24px;
    padding: 16px;
    border: 1px solid #f56c6c;
    border-radius: 4px;
    background: #fef0f0;
  }

  .danger-block h3 {
    margin: 0 0 8px 0;
    color: #f56c6c;
    font-size: 14px;
  }
}
</style>

