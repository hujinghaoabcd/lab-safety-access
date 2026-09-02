<template>
  <div class="desktop-ranking">
    <div v-if="scoreRanking.length" class="ranking-layout">
      <section class="ranking-main">
        <div class="panel-heading compact-heading">
          <h2>成绩排名</h2>
          <span class="panel-count">按最高成绩从高到低 · 共 {{ participantCount }} 人</span>
        </div>

        <el-table
          v-loading="loading"
          :data="scoreRanking"
          class="ranking-table"
          :row-class-name="getRowClassName"
        >
          <el-table-column label="排名" width="92" align="center">
            <template #default="{ row }">
              <span class="rank-badge" :class="row.rank <= 3 ? `rank-badge-${row.rank}` : ''">
                {{ row.rank }}
              </span>
            </template>
          </el-table-column>

          <el-table-column label="学员" min-width="250">
            <template #default="{ row }">
              <div class="student-cell">
                <el-avatar :size="38" :src="row.avatar">{{ row.name?.[0] }}</el-avatar>
                <div class="student-name-row">
                  <span class="student-name">{{ row.name }}</span>
                  <span v-if="myRanking.rank && row.rank === myRanking.rank" class="me-mark">我</span>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="department" label="院系" min-width="240">
            <template #default="{ row }">
              <span class="department-text">{{ row.department || '—' }}</span>
            </template>
          </el-table-column>

          <el-table-column label="最高分" width="150" align="right">
            <template #default="{ row }">
              <span class="score-cell"><strong>{{ row.score }}</strong><em>分</em></span>
            </template>
          </el-table-column>
        </el-table>
      </section>

      <aside class="ranking-sidebar">
        <section class="my-rank-panel">
          <div class="my-rank-top">
            <div class="my-rank-copy">
              <div class="my-rank-kicker">我的成绩</div>
              <div class="my-rank-label">当前排名</div>
            </div>
            <div class="my-rank-number">
              <strong>{{ myRanking.rank || '—' }}</strong>
              <span v-if="myRanking.rank">/ {{ participantCount }}</span>
              <span v-else>未上榜</span>
            </div>
          </div>
          <div class="my-rank-stats">
            <div>
              <span>最高分</span>
              <strong>{{ myRanking.score || 0 }}<small>分</small></strong>
            </div>
            <div>
              <span>参与人数</span>
              <strong>{{ participantCount }}<small>人</small></strong>
            </div>
          </div>
        </section>

        <section class="leaders-panel">
          <div class="leaders-heading compact-heading">
            <h2>领先学员</h2>
            <span class="panel-count">当前前三名</span>
          </div>

          <div class="leaders-list">
            <div
              v-for="item in topThree"
              :key="item.userId"
              class="leader-item"
            >
              <span class="leader-rank" :class="`leader-rank-${item.rank}`">{{ item.rank }}</span>
              <el-avatar :size="46" :src="item.avatar">{{ item.name?.[0] }}</el-avatar>
              <div class="leader-info">
                <div class="leader-name">{{ item.name }}</div>
                <div class="leader-department">{{ item.department || '未设置院系' }}</div>
              </div>
              <div class="leader-score"><strong>{{ item.score }}</strong><span>分</span></div>
            </div>
          </div>
        </section>
      </aside>
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
const participantCount = computed(() => myRanking.value.total || scoreRanking.value.length)

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

.ranking-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 20px;
  align-items: start;
}

.ranking-main,
.leaders-panel,
.ranking-empty {
  background: #fff;
  border: 1px solid #e1e6ec;
}

.panel-heading,
.leaders-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 60px;
  padding: 13px 20px;
  border-bottom: 1px solid #e8ecf1;
}

.compact-heading {
  min-height: 56px;
}

.panel-heading h2,
.leaders-heading h2 {
  margin: 0;
  color: #27313d;
  font-size: 16px;
  font-weight: 600;
}

.panel-count {
  color: #8a95a2;
  font-size: 12px;
}

.ranking-table {
  width: 100%;
}

.ranking-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.ranking-table :deep(.el-table__header th) {
  height: 42px;
  background: #f7f9fb;
  color: #6f7b89;
  font-size: 13px;
  font-weight: 600;
}

.ranking-table :deep(.el-table__row td) {
  height: 58px;
  border-bottom-color: #edf0f4;
}

.ranking-table :deep(.el-table__row:hover td) {
  background: #f8fbff !important;
}

.ranking-table :deep(.current-user-row td) {
  background: #f1f7ff !important;
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: #596675;
  font-size: 14px;
  font-weight: 650;
}

.rank-badge-1 {
  border: 1px solid #d8ad4d;
  background: #fff8e8;
  color: #916817;
}

.rank-badge-2 {
  border: 1px solid #b9c2cd;
  background: #f5f7f9;
  color: #66727f;
}

.rank-badge-3 {
  border: 1px solid #c28e68;
  background: #fbf2ec;
  color: #8d5938;
}

.student-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.student-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.student-name {
  overflow: hidden;
  color: #27313d;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.me-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 19px;
  padding: 0 6px;
  background: #eaf3ff;
  color: #0475fa;
  font-size: 11px;
  font-weight: 600;
}

.department-text {
  color: #7f8a98;
  font-size: 13px;
}

.score-cell {
  color: #7b8794;
  font-style: normal;
  white-space: nowrap;
}

.score-cell strong {
  margin-right: 4px;
  color: #0475fa;
  font-size: 20px;
  font-weight: 650;
}

.score-cell em {
  font-size: 12px;
  font-style: normal;
}

.ranking-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.my-rank-panel {
  overflow: hidden;
  background: linear-gradient(145deg, #086ee8 0%, #1688f6 100%);
  color: #fff;
}

.my-rank-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 92px;
  padding: 16px 20px;
}

.my-rank-copy {
  min-width: 0;
}

.my-rank-kicker {
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.84);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.3px;
}

.my-rank-label {
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.my-rank-number {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.my-rank-number strong {
  font-size: 38px;
  line-height: 1;
  font-weight: 650;
  letter-spacing: -0.8px;
}

.my-rank-number span {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}

.my-rank-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  border-top: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.06);
}

.my-rank-stats > div {
  padding: 11px 20px 12px;
}

.my-rank-stats > div + div {
  border-left: 1px solid rgba(255, 255, 255, 0.18);
}

.my-rank-stats span {
  display: block;
  margin-bottom: 4px;
  color: rgba(255, 255, 255, 0.76);
  font-size: 12px;
}

.my-rank-stats strong {
  font-size: 21px;
  line-height: 1.2;
  font-weight: 600;
}

.my-rank-stats small {
  margin-left: 3px;
  font-size: 12px;
  font-weight: 400;
}

.leaders-list {
  padding: 2px 0;
}

.leader-item {
  display: grid;
  grid-template-columns: 34px 46px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 70px;
  padding: 10px 16px;
}

.leader-item + .leader-item {
  border-top: 1px solid #edf0f4;
}

.leader-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid #cfd6de;
  color: #627080;
  font-size: 13px;
  font-weight: 700;
}

.leader-rank-1 {
  border-color: #d8ad4d;
  background: #fff8e8;
  color: #916817;
}

.leader-rank-2 {
  border-color: #b9c2cd;
  background: #f5f7f9;
  color: #66727f;
}

.leader-rank-3 {
  border-color: #c28e68;
  background: #fbf2ec;
  color: #8d5938;
}

.leader-info {
  min-width: 0;
}

.leader-name {
  overflow: hidden;
  margin-bottom: 3px;
  color: #26313d;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leader-department {
  overflow: hidden;
  color: #8a95a2;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leader-score {
  white-space: nowrap;
}

.leader-score strong {
  margin-right: 3px;
  color: #0475fa;
  font-size: 19px;
  font-weight: 650;
}

.leader-score span {
  color: #8b96a3;
  font-size: 12px;
}

.ranking-empty {
  padding: 70px 0;
}

@media (max-width: 1180px) {
  .ranking-layout {
    grid-template-columns: 1fr;
  }

  .ranking-sidebar {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
  }
}
</style>
