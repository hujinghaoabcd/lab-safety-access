import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface UserInfo {
  id: string
  name: string
  studentId: string
  department: string
  avatar?: string
  phone?: string
  email?: string
}

export const useUserStore = defineStore('user', () => {
  const authenticated = ref(false)
  const userInfo = ref<UserInfo | null>(null)

  const isLoggedIn = computed(() => authenticated.value)

  function setAuthenticated(value: boolean) {
    authenticated.value = value
  }

  function setUserInfo(info: UserInfo) {
    userInfo.value = info
    authenticated.value = true
  }

  function logout() {
    authenticated.value = false
    userInfo.value = null
  }

  return {
    authenticated,
    userInfo,
    isLoggedIn,
    setAuthenticated,
    setUserInfo,
    logout
  }
})
