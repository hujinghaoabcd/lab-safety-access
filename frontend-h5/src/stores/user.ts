import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { clearStudentSession } from '@/utils/session'

export interface UserInfo {
  id: string
  name: string
  studentId: string
  department: string
  avatar?: string | null
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
    clearStudentSession()
    // Existing mobile/desktop UI calls this synchronous store method. Fire the
    // idempotent server logout in the background so the HttpOnly cookie is
    // cleared without forcing a broad UI refactor in this security change.
    void fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' }
    }).catch(() => {})
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
