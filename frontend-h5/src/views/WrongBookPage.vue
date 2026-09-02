<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { getWrongBook, removeWrongQuestion } from '../api/exam'

const router = useRouter()

interface WrongQuestion {
  id: number | string
  type: string
  content: string
  options: string[]
  correctAnswer: string
  wrongCount: number
  lastWrongTime: string | null
}

const allQuestions = ref<WrongQuestion[]>([])
const loading = ref(false)
const filterType = ref<'all' | '单选题' | '多选题' | '判断题'>('all')

const loadWrongBook = async () => {
  try {
    loading.value = true
    const resp: any = await getWrongBook()
    const data = resp?.data ?? resp
    console.log('[WrongBook] getWrongBook response:', data)
    allQuestions.value = data || []
  } catch (err: any) {
    console.error('[WrongBook] getWrongBook error:', err)
    showToast(err?.message || '加载错题本失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadWrongBook()
})

const filtered = computed(() => {
  if (filterType.value === 'all') return allQuestions.value
  return allQuestions.value.filter(q => q.type === filterType.value)
})

const counts = computed(() => ({
  all: allQuestions.value.length,
  '单选题': allQuestions.value.filter(q => q.type === '单选题').length,
  '多选题': allQuestions.value.filter(q => q.type === '多选题').length,
  '判断题': allQuestions.value.filter(q => q.type === '判断题').length
}))

const setFilter = (t: 'all' | '单选题' | '多选题' | '判断题') => {
  filterType.value = t
}

const removeOne = async (id: number | string) => {
  try {
    await showConfirmDialog({
      title: '确认',
      message: '确认这道题已经掌握，移出错题本吗？'
    })
    await removeWrongQuestion(id)
    showToast('已移出错题本')
    loadWrongBook()
  } catch (err: any) {
    if (err === 'cancel') return
    console.error('[WrongBook] removeWrongQuestion error:', err)
    showToast(err?.message || '移除失败')
  }
}

const clearAll = async () => {
  if (!allQuestions.value.length) return
  try {
    await showConfirmDialog({
      title: '清空错题本',
      message: '确定要清空当前所有错题吗？此操作不可恢复。'
    })
    const ids = allQuestions.value.map(q => q.id)
    await Promise.all(ids.map(id => removeWrongQuestion(id)))
    showToast('已清空错题本')
    loadWrongBook()
  } catch (err: any) {
    if (err === 'cancel') return
    console.error('[WrongBook] clearAll error:', err)
    showToast(err?.message || '清空失败')
  }
}

const retryQuestion = (_q: WrongQuestion) => {
  router.push({ path: '/exam-center' })
}
</script>

<template>
  <div class="wrongbook-page">
    <van-nav-bar class="blue-nav" title="错题本" left-arrow @click-left="router.back()" />

    <div class="content">
      <div class="filter-bar">
        <div class="tabs">
          <span :class="['tab', { active: filterType === 'all' }]" @click="setFilter('all')">
            全部 ({{ counts.all }})
          </span>
          <span :class="['tab', { active: filterType === '单选题' }]" @click="setFilter('单选题')">
            单选 ({{ counts['单选题'] }})
          </span>
          <span :class="['tab', { active: filterType === '多选题' }]" @click="setFilter('多选题')">
            多选 ({{ counts['多选题'] }})
          </span>
          <span :class="['tab', { active: filterType === '判断题' }]" @click="setFilter('判断题')">
            判断 ({{ counts['判断题'] }})
          </span>
        </div>
        <div class="actions">
          <van-button size="small" type="danger" plain @click="clearAll" :disabled="!allQuestions.length">清空</van-button>
        </div>
      </div>

      <div class="question-list" v-if="!loading">
        <div v-for="q in filtered" :key="q.id" class="question-card">
          <div class="card-header">
            <div class="left">
              <span class="badge">
                {{ q.type === '多选题' ? '多选' : q.type === '判断题' ? '判断' : '单选' }}
              </span>
              <span class="exam">错题次数：{{ q.wrongCount }} 次</span>
            </div>
            <div class="right">
              <span class="time">{{ q.lastWrongTime || '' }}</span>
            </div>
          </div>

          <div class="card-body">
            <p class="question-text">{{ q.content }}</p>

            <div class="options">
              <div
                v-for="(opt, idx) in q.options"
                :key="opt"
                class="option-row"
                :class="{
                  correct: q.correctAnswer.includes(String.fromCharCode(65 + idx))
                }"
              >
                <span class="letter">{{ String.fromCharCode(65 + idx) }}</span>
                <span class="text">{{ opt }}</span>
              </div>
            </div>

            <div class="answer-line">
              <span>正确答案：<b class="correct">{{ q.correctAnswer }}</b></span>
            </div>

            <div class="card-actions">
              <van-button size="small" type="primary" @click="retryQuestion(q)">重新考试</van-button>
              <van-button size="small" plain type="default" @click="removeOne(q.id)">我会了</van-button>
            </div>
          </div>
        </div>

        <van-empty v-if="!filtered.length && !loading" description="暂无错题" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrongbook-page { min-height: 100vh; background: #f7f8fa; }
.content { padding: 4vw; }

.filter-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3.2vw; }
.tabs { display: flex; gap: 2vw; flex-wrap: wrap; }
.tab { background: #fff; padding: 1.6vw 2.667vw; font-size: 3.2vw; color: #646566; cursor: pointer; }
.tab.active { color: #0475FA; border: 1px solid #0475FA; }

.question-list { display: flex; flex-direction: column; gap: 3.2vw; }
.question-card { background: #fff; overflow: hidden; }
.card-header { display: flex; justify-content: space-between; align-items: center; padding: 3vw 4vw; background: #fafafa; border-bottom: 1px solid #f0f0f0; }
.card-header .left { display: flex; align-items: center; gap: 2vw; }
.badge { padding: 0.8vw 2vw; border: 1px solid #0475FA; color: #0475FA; font-size: 3vw; }
.exam { font-size: 3vw; color: #969799; }
.time { font-size: 3vw; color: #969799; }

.card-body { padding: 4vw; }
.question-text { font-size: 3.8vw; color: #323233; line-height: 1.6; margin-bottom: 3.2vw; }
.options { display: flex; flex-direction: column; }
.option-row { display: flex; align-items: center; padding: 3vw 0; border-bottom: 1px solid #f0f0f0; }
.option-row:last-child { border-bottom: none; }
.letter { width: 6vw; font-size: 3.6vw; color: #666; }
.text { flex: 1; font-size: 3.6vw; color: #323233; }
.option-row.correct { background: #f0f7ff; }
.option-row.wrong { background: #fff5f5; }

.answer-line { display: flex; justify-content: space-between; gap: 3vw; margin-top: 3vw; font-size: 3.2vw; color: #646566; }
.answer-line .wrong { color: #ee0a24; }
.answer-line .correct { color: #07c160; }

.card-actions { display: flex; gap: 2vw; margin-top: 3vw; }
</style>
