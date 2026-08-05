<script setup lang="ts">
import { ref, onMounted } from 'vue'
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

const defaultAvatar = 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'
const resolveAvatarUrl = (raw?: string | null) => {
  if (!raw) return defaultAvatar
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
    console.log('[Ranking] getRanking response:', data)

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
    <!-- <van-nav-bar class="blue-nav" title="排行榜" left-arrow @click-left="router.back()" /> -->

    <!-- 我的排名 -->
    <div class="my-rank-bar">
      <div class="rank-item-left">
        <span class="label">我的排名</span>
        <span class="value">{{ myRanking.rank }}<small>/{{ myRanking.total }}</small></span>
      </div>
      <div class="rank-item-right">
        <span class="label">最高分</span>
        <span class="value">{{ myRanking.score }}分</span>
      </div>
    </div>

    <div class="content">
      <!-- 前三名展示 -->
      <div class="top-three">
        <div class="top-item second" v-if="scoreRanking[1]">
          <div class="medal">🥈</div>
          <van-image round width="14vw" height="14vw" :src="scoreRanking[1].avatar" fit="cover" />
          <div class="top-name">{{ scoreRanking[1].name }}</div>
          <div class="top-score">{{ scoreRanking[1].score }}分</div>
        </div>
        <div class="top-item first" v-if="scoreRanking[0]">
          <div class="medal">🥇</div>
          <div class="crown">👑</div>
          <van-image round width="18vw" height="18vw" :src="scoreRanking[0].avatar" fit="cover" />
          <div class="top-name">{{ scoreRanking[0].name }}</div>
          <div class="top-score">{{ scoreRanking[0].score }}分</div>
        </div>
        <div class="top-item third" v-if="scoreRanking[2]">
          <div class="medal">🥉</div>
          <van-image round width="14vw" height="14vw" :src="scoreRanking[2].avatar" fit="cover" />
          <div class="top-name">{{ scoreRanking[2].name }}</div>
          <div class="top-score">{{ scoreRanking[2].score }}分</div>
        </div>
      </div>

      <!-- 排行列表 -->
      <div class="rank-list">
        <div class="list-title">
          <van-icon name="fire-o" color="#ff976a" />
          <span>排行榜单</span>
        </div>

        <div v-if="!scoreRanking.length && !loading" class="empty-text">
          暂无排行榜数据
        </div>
        <div v-else>
          <div
            v-for="(item, idx) in scoreRanking.slice(3)"
            :key="item.userId"
            class="rank-row"
            :style="{ animationDelay: idx * 0.05 + 's' }"
          >
            <div class="rank-num">{{ item.rank }}</div>
            <van-image round width="10vw" height="10vw" :src="item.avatar" />
            <div class="user-detail">
              <p class="user-name">{{ item.name }}</p>
              <p class="user-dept">{{ item.department }}</p>
            </div>
            <div class="score-area">
              <span class="score-num">{{ item.score }}</span>
              <span class="score-unit">分</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ranking-page {
  min-height: 100vh;
  background: #f7f8fa;
}

/* 我的排名条 */
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

.my-rank-bar .value small {
  font-size: 3.2vw;
  font-weight: 400;
  opacity: 0.8;
}

.content {
  padding: 0 4vw 4vw;
}

/* 前三名 */
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

/* 排行列表 */
.rank-list {
  background: #fff;
  padding: 4vw;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}

.list-title {
  display: flex;
  align-items: center;
  gap: 2vw;
  font-size: 4vw;
  font-weight: 600;
  color: #323233;
  margin-bottom: 4vw;
  padding-bottom: 3vw;
  border-bottom: 1px solid #f0f0f0;
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

.rank-row:last-child {
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
}

.user-detail {
  flex: 1;
  margin-left: 3vw;
}

.user-name {
  font-size: 3.8vw;
  font-weight: 500;
  color: #323233;
}

.user-dept {
  font-size: 3vw;
  color: #969799;
  margin-top: 0.5vw;
}

.score-area {
  display: flex;
  align-items: baseline;
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
</style>
