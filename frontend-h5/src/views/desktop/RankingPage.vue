<template>
  <div class="desktop-ranking">
    <div class="page-heading">
      <div>
        <h1>排行榜</h1>
        <p>按考试最高成绩展示当前成绩排名</p>
      </div>
      <div class="heading-meta">共 {{ myRanking.total || scoreRanking.length }} 人参与排名</div>
    </div>

    <div class="ranking-summary">
      <div class="summary-item summary-primary">
        <span class="summary-label">我的排名</span>
        <div class="summary-value">
          <strong>{{ myRanking.rank || '—' }}</strong>
          <span v-if="myRanking.rank">/ {{ myRanking.total || scoreRanking.length }}</span>
          <span v-else>未上榜</span>
        </div>
      </div>
      <div class="summary-item">
        <span class="summary-label">我的最高分</span>
        <div class="summary-value">
          <strong>{{ myRanking.score || 0 }}</strong><span>分</span>
        </div>
      </div>
      <div class="summary-item">
        <span class="summary-label">当前榜首</span>
        <div class="summary-value summary-name">
          <strong>{{ scoreRanking[0]?.name || '—' }}</strong>
          <span v-if="scoreRanking[0]">{{ scoreRanking[0].score }} 分</span>
        </div>
      </div>
      <div class="summary-item">
        <span class="summary-label">参与人数</span>
        <div class="summary-value">
          <strong>{{ myRanking.total || scoreRanking.length }}</strong><span>人</span>
        </div>
      </div>
    </div>

    <div v-if="scoreRanking.length" class="ranking-panel">
      <div class="panel-header">
        <div>
          <h2>成绩榜单</h2>
          <p>前 3 名重点展示，其余成员按最高分依次排列</p>
        </div>
      </div>

      <div v-if="topThree.length" class="top-three-grid">
        <div
          v-for="item in topThree"
          :key="item.userId"
          class="top-rank-item"
          :class="`rank-${item.rank}`"
        >
          <div class="rank-mark">{{ item.rank }}</div>
          <el-avatar :size="64" :src="item.avatar">{{ item.name?.[0] }}</el-avatar>
          <div class="top-user-info">
            <div class="top-name">{{ item.name }}</div>
            <div class="top-department">{{ item.department || '未设置院系' }}</div>
          </div>
          <div class="top-score">
            <strong>{{ item.score }}</strong><span>分</span>
          </div>
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="scoreRanking"
        class="ranking-table"
        :row-class-name="getRowClassName"
        border
      >
        <el-table-column label="排名" width="90" align="center">
          <template #default="{ row }">
            <span class="table-rank" :class="row.rank <= 3 ? `table-rank-${row.rank}` : ''">
              {{ row.rank }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="学员" min-width="220">
          <template #default="{ row }">
            <div class="student-cell">
              <el-avatar :size="40" :src="row.avatar">{{ row.name?.[0] }}</el-avatar>
              <span>{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="department" label="院系" min-width="240">
          <template #default="{ row }">
            {{ row.department || '—' }}
          </template>
        </el-table-column>
        <el-table-column label="最高分" width="140" align="right">
          <template #default="{ row }">
            <span class="score-cell"><strong>{{ row.score }}</strong> 分</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-else-if="!loading" class="ranking-empty">
      <el-empty description="暂无排行榜数据" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getRanking } from '@/api/exam'

interface RankingItem {
  userId: number
  rank: number
  name: string
  avatar: string
  department: string
  score: number
}

const defaultAvatar = 'https://unpkg.com/@vant/assets@1.0.8/cat.jpeg'

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
const topThree = computed(() => scoreRanking.value.slice(0, 3))

const getRowClassName = ({ row }: { row: RankingItem }) => {
  return myRanking.value.rank && row.rank === myRanking.value.rank ? 'current-user-row' : ''
}

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
  width: 100%;
}

.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #dfe4ea;
}

.page-heading h1 {
  margin: 0 0 6px;
  color: #1f2937;
  font-size: 24px;
  font-weight: 600;
}

.page-heading p,
.panel-header p {
  margin: 0;
  color: #8a94a3;
  font-size: 13px;
}

.heading-meta {
  color: #7b8794;
  font-size: 13px;
}

.ranking-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 20px;
  background: #fff;
  border: 1px solid #e1e6ec;
}

.summary-item {
  min-height: 108px;
  padding: 22px 26px;
  border-right: 1px solid #e7ebf0;
}

.summary-item:last-child {
  border-right: 0;
}

.summary-primary {
  border-top: 3px solid #0475fa;
  padding-top: 19px;
}

.summary-label {
  display: block;
  margin-bottom: 13px;
  color: #7c8796;
  font-size: 13px;
}

.summary-value {
  display: flex;
  align-items: baseline;
  gap: 5px;
  color: #52606f;
  font-size: 13px;
}

.summary-value strong {
  color: #17202a;
  font-size: 30px;
  line-height: 1;
  font-weight: 600;
}

.summary-name {
  align-items: center;
  justify-content: space-between;
}

.summary-name strong {
  max-width: 65%;
  overflow: hidden;
  color: #1f2937;
  font-size: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranking-panel,
.ranking-empty {
  background: #fff;
  border: 1px solid #e1e6ec;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 18px;
  border-bottom: 1px solid #e7ebf0;
}

.panel-header h2 {
  margin: 0 0 5px;
  color: #27313d;
  font-size: 17px;
  font-weight: 600;
}

.top-three-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-bottom: 1px solid #e7ebf0;
}

.top-rank-item {
  position: relative;
  display: grid;
  grid-template-columns: 44px 64px minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  min-height: 112px;
  padding: 20px 24px;
  border-right: 1px solid #e7ebf0;
}

.top-rank-item:last-child {
  border-right: 0;
}

.rank-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid #cfd6df;
  color: #4f5c6b;
  font-size: 15px;
  font-weight: 700;
}

.rank-1 {
  box-shadow: inset 0 3px 0 #c99b34;
}

.rank-2 {
  box-shadow: inset 0 3px 0 #8e9aa8;
}

.rank-3 {
  box-shadow: inset 0 3px 0 #a96f45;
}

.rank-1 .rank-mark {
  border-color: #d2aa54;
  background: #fff8e8;
  color: #9a6d16;
}

.rank-2 .rank-mark {
  border-color: #aeb8c3;
  background: #f3f5f7;
  color: #687582;
}

.rank-3 .rank-mark {
  border-color: #bb8b69;
  background: #faf1eb;
  color: #8b5737;
}

.top-user-info {
  min-width: 0;
}

.top-name {
  overflow: hidden;
  margin-bottom: 6px;
  color: #1f2937;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-department {
  overflow: hidden;
  color: #8a94a3;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-score {
  color: #6b7683;
  font-size: 12px;
  white-space: nowrap;
}

.top-score strong {
  margin-right: 3px;
  color: #0475fa;
  font-size: 24px;
  font-weight: 600;
}

.ranking-table {
  width: 100%;
}

.ranking-table :deep(.el-table__header th) {
  height: 46px;
  background: #f7f9fb;
  color: #66717f;
  font-weight: 600;
}

.ranking-table :deep(.el-table__row td) {
  height: 62px;
}

.ranking-table :deep(.current-user-row td) {
  background: #f1f7ff !important;
}

.student-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #27313d;
  font-weight: 500;
}

.table-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 28px;
  color: #536170;
  font-weight: 600;
}

.table-rank-1 {
  color: #9a6d16;
}

.table-rank-2 {
  color: #687582;
}

.table-rank-3 {
  color: #8b5737;
}

.score-cell {
  color: #66717f;
}

.score-cell strong {
  margin-right: 3px;
  color: #0475fa;
  font-size: 17px;
}

.ranking-empty {
  padding: 60px 0;
}

@media (max-width: 1180px) {
  .ranking-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .summary-item:nth-child(2) {
    border-right: 0;
  }

  .summary-item:nth-child(-n + 2) {
    border-bottom: 1px solid #e7ebf0;
  }

  .top-three-grid {
    grid-template-columns: 1fr;
  }

  .top-rank-item {
    border-right: 0;
    border-bottom: 1px solid #e7ebf0;
  }

  .top-rank-item:last-child {
    border-bottom: 0;
  }
}
</style>
