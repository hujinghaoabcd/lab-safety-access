import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { clearStudentSession } from '@/utils/session'

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

  // Transitional compatibility for the older login components. The argument
  // is deliberately ignored: no JWT or other secret is persisted.
  function setToken(_unusedToken?: string) {
    authenticated.value = true
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
    setToken,
    setUserInfo,
    logout
  }
})
