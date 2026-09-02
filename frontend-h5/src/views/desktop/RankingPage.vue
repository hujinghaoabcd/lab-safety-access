<template>
  <div class="desktop-ranking">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <div class="header-icon">
          <el-icon><Trophy /></el-icon>
        </div>
        <div class="header-info">
          <h1>排行榜</h1>
          <p>查看考试成绩排名</p>
        </div>
      </div>
    </div>

    <!-- 我的排名 -->
    <div class="my-rank-card">
      <div class="rank-item">
        <span class="rank-label">我的排名</span>
        <span class="rank-value">{{ myRanking.rank || '未上榜' }}<span class="rank-total">/{{ myRanking.total }}</span></span>
      </div>
      <div class="rank-divider"></div>
      <div class="rank-item">
        <span class="rank-label">最高分</span>
        <span class="rank-value highlight">{{ myRanking.score }}分</span>
      </div>
    </div>

    <!-- 前三名 -->
    <div v-if="scoreRanking.length >= 3" class="top-three-section">
      <div class="section-title">🏆 前三名</div>
      <div class="top-three">
        <div class="top-item second" v-if="scoreRanking[1]">
          <span class="medal">🥈</span>
          <el-avatar :size="64" :src="scoreRanking[1].avatar">{{ scoreRanking[1].name?.[0] }}</el-avatar>
          <span class="top-name">{{ scoreRanking[1].name }}</span>
          <span class="top-score">{{ scoreRanking[1].score }}分</span>
        </div>
        <div class="top-item first" v-if="scoreRanking[0]">
          <span class="medal">🥇</span>
          <el-avatar :size="80" :src="scoreRanking[0].avatar">{{ scoreRanking[0].name?.[0] }}</el-avatar>
          <span class="top-name">{{ scoreRanking[0].name }}</span>
          <span class="top-score">{{ scoreRanking[0].score }}分</span>
        </div>
        <div class="top-item third" v-if="scoreRanking[2]">
          <span class="medal">🥉</span>
          <el-avatar :size="64" :src="scoreRanking[2].avatar">{{ scoreRanking[2].name?.[0] }}</el-avatar>
          <span class="top-name">{{ scoreRanking[2].name }}</span>
          <span class="top-score">{{ scoreRanking[2].score }}分</span>
        </div>
      </div>
    </div>

    <!-- 排行榜列表 -->
    <div class="ranking-section">
      <div class="section-title">排行榜单</div>

      <el-table :data="scoreRanking.slice(3)" style="width: 100%">
        <el-table-column type="index" label="排名" width="80">
          <template #default="{ $index }">
            <span class="rank-num">{{ $index + 4 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="头像" width="80">
          <template #default="{ row }">
            <el-avatar :size="40" :src="row.avatar">{{ row.name?.[0] }}</el-avatar>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="姓名" min-width="120" />
        <el-table-column prop="department" label="院系" min-width="160" />
        <el-table-column label="分数" width="100">
          <template #default="{ row }">
            <span class="score-num">{{ row.score }}分</span>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && scoreRanking.length === 0" description="暂无排行榜数据" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Trophy } from '@element-plus/icons-vue'
import { getRanking } from '@/api/exam'
import defaultAvatar from '@/assets/default-cat-avatar.svg'

interface RankingItem {
  userId: number
  rank: number
  name: string
  avatar: string
  department: string
  score: number
}

const isLegacyDefaultAvatar = (raw: string) =>
  raw.includes('@vant/assets/cat.jpeg') || raw.includes('img.yzcdn.cn/vant/cat.jpeg')

const resolveAvatarUrl = (raw?: string | null) => {
  if (!raw) return defaultAvatar
  if (isLegacyDefaultAvatar(raw)) return defaultAvatar
  if (raw.startsWith('http')) return raw
  return '/api' + raw
}

const scoreRanking = ref<RankingItem[]>([])
const myRanking = ref({ rank: 0, score: 0, total: 0 })
const loading = ref(false)

onMounted(async () => {
  try {
    loading.value = true
    const resp: any = await getRanking()
    const data = resp?.data ?? resp

    scoreRanking.value = (data?.list || []).map((item: any) => ({
      userId: item.userId,
      rank: item.rank,
      name: item.name,
      department: item.department,
      score: item.score,
      avatar: resolveAvatarUrl(item.avatar)
    }))

    myRanking.value = data?.me || { rank: 0, score: 0, total: scoreRanking.value.length }
  } catch (err: any) {
    ElMessage.error(err?.message || '加载排行榜失败')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.desktop-ranking {
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

/* 我的排名 */
.my-rank-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 40px;
  padding: 24px;
  background: #0475FA;
  border-radius: 8px;
  margin-bottom: 16px;
  color: #fff;
}

.rank-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.rank-label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.rank-value {
  font-size: 32px;
  font-weight: 700;
}

.rank-total {
  font-size: 18px;
  opacity: 0.7;
}

.rank-value.highlight {
  color: #ffd700;
}

.rank-divider {
  width: 1px;
  height: 48px;
  background: rgba(255, 255, 255, 0.3);
}

/* 前三名 */
.top-three-section {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
}

.top-three {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 32px;
  padding: 20px 0;
}

.top-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.top-item.first { order: 2; }
.top-item.second { order: 1; }
.top-item.third { order: 3; }

.medal {
  font-size: 32px;
}

.top-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.top-score {
  font-size: 18px;
  font-weight: 700;
  color: #e6a23c;
}

/* 排行榜列表 */
.ranking-section {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.rank-num {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.score-num {
  font-size: 16px;
  font-weight: 600;
  color: #e6a23c;
}
</style>
