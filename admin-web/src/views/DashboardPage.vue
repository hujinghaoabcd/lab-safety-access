<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import * as adminApi from '@/api/admin'

// 统计数据
const stats = ref([
  { title: '用户总数', value: 0, icon: 'User', color: '#0475FA', trend: '+12%' },
  { title: '题目总数', value: 0, icon: 'Document', color: '#67c23a', trend: '+5%' },
  { title: '今日考试', value: 0, icon: 'EditPen', color: '#e6a23c', trend: '+23%' },
  { title: '通过率', value: '0%', icon: 'CircleCheck', color: '#f56c6c', trend: '+2.3%' }
])

// 最近考试记录
const recentExams = ref<any[]>([])

// 初始化图表
const chartRef = ref<HTMLElement | null>(null)
const pieChartRef = ref<HTMLElement | null>(null)
const router = useRouter()

const goToRecords = () => {
  router.push('/records')
}

// 加载数据
const loadData = async () => {
  try {
    // 加载统计数据
    const statsData = await adminApi.getDashboardStats()
    stats.value[0].value = statsData.userCount || 0
    stats.value[1].value = statsData.questionCount || 0
    stats.value[2].value = statsData.todayExamCount || 0
    stats.value[3].value = statsData.passRate || '0%'

    // 加载图表数据
    const chartData = await adminApi.getChartData()
    
    // 更新折线图
    if (chartRef.value) {
      const chart = echarts.init(chartRef.value)
      chart.setOption({
        title: { text: '近7天考试趋势', textStyle: { fontSize: 14 } },
        tooltip: { trigger: 'axis' },
        xAxis: {
          type: 'category',
          data: chartData.trend?.dates || []
        },
        yAxis: { type: 'value' },
        series: [
          {
            name: '考试人数',
            type: 'line',
            smooth: true,
            data: chartData.trend?.values || [],
            itemStyle: { color: '#0475FA' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(4, 117, 250, 0.3)' },
                { offset: 1, color: 'rgba(4, 117, 250, 0)' }
              ])
            }
          }
        ]
      })
      
      window.addEventListener('resize', () => chart.resize())
    }
    
    // 更新饼图（图例分两排）
    if (pieChartRef.value) {
      const chart = echarts.init(pieChartRef.value)
      const dist = chartData.distribution || []
      const names = dist.map((d: any) => d.name)
      const mid = Math.ceil(names.length / 2)
      const legendTop = names.slice(0, mid)
      const legendBottom = names.slice(mid)

      chart.setOption({
        title: { text: '题目分类分布', textStyle: { fontSize: 14 } },
        tooltip: { trigger: 'item' },
        legend: [
          { bottom: 10, left: 'center', orient: 'horizontal', data: legendTop, icon: 'circle', itemWidth: 10, itemHeight: 10, itemGap: 10, padding: 0 },
          { bottom: -2, left: 'center', orient: 'horizontal', data: legendBottom, icon: 'circle', itemWidth: 10, itemHeight: 10, itemGap: 10, padding: 0 }
        ],
        series: [
          {
            type: 'pie',
            radius: ['42%', '68%'],
            center: ['50%', '52%'],
            data: dist,
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              }
            }
          }
        ]
      })
      
      window.addEventListener('resize', () => chart.resize())
    }

    // 加载最近考试记录
    const records = await adminApi.getRecentExams()
    recentExams.value = records.map((r: any) => ({
      id: r.id,
      user: r.studentName,
      exam: r.examName,
      score: r.score,
      status: r.status,
      time: r.submitTime
    }))
  } catch (err) {
    console.error('加载数据失败:', err)
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :xs="24" :sm="12" :lg="6" v-for="item in stats" :key="item.title">
        <div class="stat-card">
          <div class="stat-icon" :style="{ background: item.color }">
            <el-icon :size="24"><component :is="item.icon" /></el-icon>
          </div>
          <div class="stat-info">
            <p class="stat-title">{{ item.title }}</p>
            <p class="stat-value">{{ item.value }}</p>
            <p class="stat-trend">较昨日 <span>{{ item.trend }}</span></p>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row :gutter="20" class="chart-row">
      <el-col :xs="24" :lg="14">
        <div class="chart-card">
          <div ref="chartRef" style="height: 300px"></div>
        </div>
      </el-col>
      <el-col :xs="24" :lg="10">
        <div class="chart-card">
          <div ref="pieChartRef" style="height: 300px"></div>
        </div>
      </el-col>
    </el-row>

    <!-- 最近考试记录 -->
    <div class="table-card">
      <div class="card-header">
        <h3>最近考试记录</h3>
        <el-button type="primary" link @click="goToRecords">查看更多</el-button>
      </div>
      <el-table :data="recentExams" stripe>
        <el-table-column prop="user" label="学生姓名" width="100" />
        <el-table-column prop="exam" label="考试名称" min-width="200" />
        <el-table-column prop="score" label="分数" width="80">
          <template #default="{ row }">
            <span :style="{ color: row.score >= 60 ? '#67c23a' : '#f56c6c' }">
              {{ row.score }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === '通过' ? 'success' : 'danger'" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="time" label="考试时间" width="180" />
      </el-table>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.dashboard {
  .stats-row {
    margin-bottom: 20px;
    
    .el-col {
      margin-bottom: 20px;
    }
  }
  
  .stat-card {
    background: #fff;
    border-radius: 4px;
    padding: 24px;
    display: flex;
    align-items: center;
    gap: 20px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    transition: all 0.3s ease;
    cursor: pointer;
    border: 1px solid transparent;
    
    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
      border-color: rgba(4, 117, 250, 0.2);
    }
    
    .stat-icon {
      width: 64px;
      height: 64px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    .stat-info {
      flex: 1;
      min-width: 0;
      
      .stat-title {
        font-size: 14px;
        color: #909399;
        margin: 0 0 12px;
        font-weight: 500;
      }
      
      .stat-value {
        font-size: 28px;
        font-weight: 700;
        color: #303133;
        margin: 0 0 8px;
        line-height: 1.2;
      }
      
      .stat-trend {
        font-size: 13px;
        color: #909399;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 4px;
        
        span {
          color: #67c23a;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          
          &::before {
            content: '↑';
            margin-right: 2px;
          }
        }
      }
    }
  }
  
  .chart-row {
    margin-bottom: 20px;
    
    .el-col {
      margin-bottom: 20px;
    }
  }
  
  .chart-card {
    background: #fff;
    border-radius: 4px;
    padding: 20px;
  }
  
  .table-card {
    background: #fff;
    border-radius: 4px;
    padding: 20px;
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      
      h3 {
        font-size: 16px;
        font-weight: 600;
        margin: 0;
      }
    }
  }
}
</style>

