<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { isDesktop } from '@/utils/device'
import DesktopLayout from '@/layouts/DesktopLayout.vue'

const route = useRoute()

// 判断是否为登录页
const isLoginPage = computed(() => route.path === '/login')

// 桌面端且非登录页使用布局
const useLayout = computed(() => isDesktop() && !isLoginPage.value)
</script>

<template>
  <!-- 桌面端：使用布局（登录页除外） -->
  <DesktopLayout v-if="useLayout">
    <RouterView />
  </DesktopLayout>
  <!-- 移动端或登录页：直接显示内容 -->
  <RouterView v-else />
</template>

<style>
#app {
  width: 100%;
  min-height: 100vh;
}
</style>

