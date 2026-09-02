<template>
  <div class="desktop-ranking">
    <div class="page-heading">
      <div>
        <h1>排行榜</h1>
        <p>按考试最高成绩统计当前排名</p>
      </div>
      <div class="heading-meta">{{ participantCount }} 人参与排名</div>
    </div>

    <div v-if="scoreRanking.length" class="ranking-layout">
      <section class="ranking-main">
        <div class="panel-heading">
          <div>
            <h2>成绩排名</h2>
            <p>按最高成绩从高到低排列</p>
          </div>
          <span class="panel-count">共 {{ participantCount }} 人</span>
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
                <el-avatar :size="42" :src="row.avatar">{{ row.name?.[0] }}</el-avatar>
                <div class="student-text">
                  <div class="student-name-row">
                    <span class="student-name">{{ row.name }}</span>
                    <span v-if="myRanking.rank && row.rank === myRanking.rank" class="me-mark">我</span>
                  </div>
                  <span class="student-id">排名第 {{ row.rank }} 位</span>
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
          <div class="my-rank-kicker">我的成绩</div>
          <div class="my-rank-primary">
            <div class="my-rank-number">
              <strong>{{ myRanking.rank || '—' }}</strong>
              <span v-if="myRanking.rank">/ {{ participantCount }}</span>
              <span v-else>未上榜</span>
            </div>
            <div class="my-rank-label">当前排名</div>
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
          <div class="leaders-heading">
            <div>
              <h2>领先学员</h2>
              <p>当前成绩前三名</p>
            </div>
          </div>

          <div class="leaders-list">
            <div
              v-for="item in topThree"
              :key="item.userId"
              class="leader-item"
            >
              <span class="leader-rank" :class="`leader-rank-${item.rank}`">{{ item.rank }}</span>
              <el-avatar :size="48" :src="item.avatar">{{ item.name?.[0] }}</el-avatar>
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

.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 22px;
  padding-bottom: 16px;
  border-bottom: 1px solid #dfe5ec;
}

.page-heading h1 {
  margin: 0 0 6px;
  color: #17202a;
  font-size: 24px;
  font-weight: 650;
  letter-spacing: 0.2px;
}

.page-heading p {
  margin: 0;
  color: #8b96a5;
  font-size: 13px;
}

.heading-meta {
  color: #7b8794;
  font-size: 13px;
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
  min-height: 72px;
  padding: 16px 20px;
  border-bottom: 1px solid #e8ecf1;
}

.panel-heading h2,
.leaders-heading h2 {
  margin: 0 0 4px;
  color: #27313d;
  font-size: 16px;
  font-weight: 600;
}

.panel-heading p,
.leaders-heading p {
  margin: 0;
  color: #98a2af;
  font-size: 12px;
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
  height: 44px;
  background: #f7f9fb;
  color: #6f7b89;
  font-size: 13px;
  font-weight: 600;
}

.ranking-table :deep(.el-table__row td) {
  height: 68px;
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

.student-text {
  min-width: 0;
}

.student-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.student-name {
  overflow: hidden;
  color: #27313d;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.me-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  padding: 0 5px;
  background: #eaf3ff;
  color: #0475fa;
  font-size: 10px;
  font-weight: 600;
}

.student-id,
.department-text {
  color: #8994a2;
  font-size: 12px;
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
  gap: 20px;
}

.my-rank-panel {
  overflow: hidden;
  background: linear-gradient(145deg, #086ee8 0%, #1688f6 100%);
  color: #fff;
}

.my-rank-kicker {
  padding: 18px 20px 0;
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
  letter-spacing: 0.5px;
}

.my-rank-primary {
  padding: 18px 20px 22px;
}

.my-rank-number {
  display: flex;
  align-items: baseline;
  gap: 7px;
}

.my-rank-number strong {
  font-size: 44px;
  line-height: 1;
  font-weight: 650;
  letter-spacing: -1px;
}

.my-rank-number span {
  color: rgba(255, 255, 255, 0.76);
  font-size: 14px;
}

.my-rank-label {
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.my-rank-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  border-top: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.06);
}

.my-rank-stats > div {
  padding: 14px 20px 16px;
}

.my-rank-stats > div + div {
  border-left: 1px solid rgba(255, 255, 255, 0.18);
}

.my-rank-stats span {
  display: block;
  margin-bottom: 5px;
  color: rgba(255, 255, 255, 0.68);
  font-size: 11px;
}

.my-rank-stats strong {
  font-size: 19px;
  font-weight: 600;
}

.my-rank-stats small {
  margin-left: 3px;
  font-size: 11px;
  font-weight: 400;
}

.leaders-list {
  padding: 4px 0;
}

.leader-item {
  display: grid;
  grid-template-columns: 34px 48px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 78px;
  padding: 12px 16px;
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
  margin-bottom: 4px;
  color: #26313d;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leader-department {
  overflow: hidden;
  color: #929ca8;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leader-score {
  white-space: nowrap;
}

.leader-score strong {
  margin-right: 3px;
  color: #0475fa;
  font-size: 18px;
  font-weight: 650;
}

.leader-score span {
  color: #8b96a3;
  font-size: 11px;
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
