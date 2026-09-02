<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { getRanking } from '../api/exam'

const router = useRouter()

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
const currentPage = ref(1)
const pageSize = 10

const remainingRanking = computed(() => scoreRanking.value.slice(3))
const pagedRanking = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return remainingRanking.value.slice(start, start + pageSize)
})

const handlePageChange = () => {
  requestAnimationFrame(() => {
    document.querySelector('.rank-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
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

    myRanking.value = data?.me || {
      rank: 0,
      score: 0,
      total: scoreRanking.value.length
    }
    currentPage.value = 1
  } catch (err: any) {
    console.error('[Ranking] getRanking error:', err)
    showToast(err?.message || '加载排行榜失败')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="ranking-page">
    <div v-if="loading" class="loading-state">
      <van-loading color="#0475FA" size="28px">加载排行榜...</van-loading>
    </div>

    <template v-else-if="scoreRanking.length">
      <div class="my-rank-bar">
        <div class="rank-item-left">
          <span class="label">我的排名</span>
          <span v-if="myRanking.rank" class="value">
            {{ myRanking.rank }}<small>/{{ myRanking.total }}</small>
          </span>
          <span v-else class="value unranked">未上榜</span>
        </div>
        <div class="rank-item-right">
          <span class="label">最高分</span>
          <span class="value">{{ myRanking.score }}分</span>
        </div>
      </div>

      <div class="content">
        <div class="top-three">
          <div v-if="scoreRanking[1]" class="top-item second">
            <div class="medal">🥈</div>
            <van-image round width="14vw" height="14vw" :src="scoreRanking[1].avatar" fit="cover" />
            <div class="top-name">{{ scoreRanking[1].name }}</div>
            <div class="top-score">{{ scoreRanking[1].score }}分</div>
          </div>
          <div v-if="scoreRanking[0]" class="top-item first">
            <div class="medal">🥇</div>
            <div class="crown">👑</div>
            <van-image round width="18vw" height="18vw" :src="scoreRanking[0].avatar" fit="cover" />
            <div class="top-name">{{ scoreRanking[0].name }}</div>
            <div class="top-score">{{ scoreRanking[0].score }}分</div>
          </div>
          <div v-if="scoreRanking[2]" class="top-item third">
            <div class="medal">🥉</div>
            <van-image round width="14vw" height="14vw" :src="scoreRanking[2].avatar" fit="cover" />
            <div class="top-name">{{ scoreRanking[2].name }}</div>
            <div class="top-score">{{ scoreRanking[2].score }}分</div>
          </div>
        </div>

        <div class="rank-list">
          <div class="list-title">
            <div class="list-title-main">
              <van-icon name="fire-o" color="#ff976a" />
              <span>排行榜单</span>
            </div>
            <span class="list-count">共 {{ scoreRanking.length }} 人</span>
          </div>

          <template v-if="remainingRanking.length">
            <div
              v-for="(item, idx) in pagedRanking"
              :key="item.userId"
              class="rank-row"
              :style="{ animationDelay: idx * 0.04 + 's' }"
            >
              <div class="rank-num">{{ item.rank }}</div>
              <van-image round width="10vw" height="10vw" :src="item.avatar" fit="cover" />
              <div class="user-detail">
                <p class="user-name">{{ item.name }}</p>
                <p class="user-dept">{{ item.department || '未设置院系' }}</p>
              </div>
              <div class="score-area">
                <span class="score-num">{{ item.score }}</span>
                <span class="score-unit">分</span>
              </div>
            </div>

            <div v-if="remainingRanking.length > pageSize" class="mobile-pagination">
              <van-pagination
                v-model="currentPage"
                :total-items="remainingRanking.length"
                :items-per-page="pageSize"
                mode="simple"
                prev-text="上一页"
                next-text="下一页"
                @change="handlePageChange"
              />
            </div>
          </template>

          <div v-else class="no-more-ranking">
            当前仅有前三名排名
          </div>
        </div>
      </div>
    </template>

    <div v-else class="empty-state">
      <van-empty image="search" description="暂无排行榜数据">
        <div class="empty-copy">当前还没有学员产生有效的通过成绩</div>
        <van-button type="primary" size="small" @click="router.push('/exam-center')">
          前往考试中心
        </van-button>
      </van-empty>
    </div>
  </div>
</template>

<style scoped>
.ranking-page {
  min-height: 100vh;
  background: #f7f8fa;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 55vh;
}

.my-rank-bar {
  background: linear-gradient(135deg, #0475FA 0%, #4da3ff 100%);
  margin: 4vw;
  padding: 3vw 4vw;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #fff;
}

.rank-item-left,
.rank-item-right {
  display: flex;
  align-items: center;
  gap: 2vw;
}

.my-rank-bar .label {
  font-size: 3.2vw;
  opacity: 0.9;
}

.my-rank-bar .value {
  font-size: 5vw;
  font-weight: 700;
}

.my-rank-bar .value.unranked {
  font-size: 4vw;
}

.my-rank-bar .value small {
  font-size: 3.2vw;
  font-weight: 400;
  opacity: 0.8;
}

.content {
  padding: 0 4vw 4vw;
}

.top-three {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding: 6.4vw 0;
  background: #fff;
  margin-bottom: 4vw;
}

.top-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.top-item.first {
  margin: 0 5.333vw;
}

.top-item.second,
.top-item.third {
  margin-bottom: 2.667vw;
}

.crown {
  position: absolute;
  top: -6.4vw;
  font-size: 6.4vw;
}

.medal {
  font-size: 5.333vw;
  margin-bottom: 1.6vw;
}

.top-name {
  font-size: 3.733vw;
  font-weight: 600;
  color: #323233;
  margin-top: 2.133vw;
}

.top-score {
  font-size: 3.467vw;
  color: #0475FA;
  font-weight: 600;
  margin-top: 1.067vw;
}

.rank-list {
  background: #fff;
  padding: 4vw;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.list-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2vw;
  padding-bottom: 3vw;
  border-bottom: 1px solid #f0f0f0;
}

.list-title-main {
  display: flex;
  align-items: center;
  gap: 2vw;
  color: #323233;
  font-size: 4vw;
  font-weight: 600;
}

.list-count {
  color: #969799;
  font-size: 3vw;
}

.rank-row {
  display: flex;
  align-items: center;
  padding: 3vw 0;
  border-bottom: 1px solid #f5f5f5;
  animation: slideIn 0.3s ease-out forwards;
  opacity: 0;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.rank-row:last-of-type {
  border-bottom: none;
}

.rank-num {
  width: 8vw;
  height: 8vw;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  font-size: 4vw;
  font-weight: 600;
  color: #969799;
  margin-right: 3vw;
  flex: 0 0 auto;
}

.user-detail {
  flex: 1;
  min-width: 0;
  margin-left: 3vw;
}

.user-name {
  overflow: hidden;
  margin: 0;
  color: #323233;
  font-size: 3.8vw;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-dept {
  overflow: hidden;
  margin: 0.5vw 0 0;
  color: #969799;
  font-size: 3vw;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score-area {
  display: flex;
  align-items: baseline;
  flex: 0 0 auto;
}

.score-num {
  font-size: 5vw;
  font-weight: 700;
  color: #0475FA;
}

.score-unit {
  font-size: 3vw;
  color: #969799;
  margin-left: 0.5vw;
}

.mobile-pagination {
  margin-top: 3vw;
  padding-top: 3vw;
  border-top: 1px solid #f0f0f0;
}

.mobile-pagination :deep(.van-pagination__item) {
  min-width: 20vw;
  height: 10vw;
  color: #0475FA;
  font-size: 3.4vw;
}

.mobile-pagination :deep(.van-pagination__page-desc) {
  color: #7d8794;
  font-size: 3.2vw;
}

.no-more-ranking {
  padding: 6vw 0 3vw;
  color: #969799;
  font-size: 3.4vw;
  text-align: center;
}

.empty-state {
  margin: 4vw;
  padding: 8vw 4vw 10vw;
  background: #fff;
}

.empty-copy {
  margin: -1vw 0 4vw;
  color: #969799;
  font-size: 3.4vw;
  text-align: center;
}
</style>
