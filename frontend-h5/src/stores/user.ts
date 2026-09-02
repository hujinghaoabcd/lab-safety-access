import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { beginStudentLogout } from '@/utils/session'

export interface UserInfo {
  id: string
  name: string
  studentId: string
  department: string
  avatar?: string | null
  phone?: string
  email?: string
}

const suppressLogoutOverlayResidue = () => {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  const styleId = 'student-logout-overlay-suppression'

  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      html.student-logging-out .van-dialog,
      html.student-logging-out .van-toast,
      html.student-logging-out .van-overlay {
        display: none !important;
      }
    `
    document.head.appendChild(style)
  }

  // The confirmation promise resolves slightly before Vant has fully removed
  // its teleported Dialog/Overlay. Hide mobile transient overlays only during
  // this short logout window so no residual white rectangle is painted.
  root.classList.add('student-logging-out')
  window.setTimeout(() => {
    root.classList.remove('student-logging-out')
  }, 800)
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

  async function logout() {
    suppressLogoutOverlayResidue()
    authenticated.value = false
    userInfo.value = null

    // Mark this as an intentional logout before the cookie is cleared. Any
    // profile/stats requests that finish with 401 during the next moments are
    // expected and must not trigger another hard redirect to /login.
    beginStudentLogout({ routeHoldMs: 360, quietMs: 2500 })

    try {
      // Logout is idempotent server-side. Awaiting it lets desktop navigation
      // happen only after the HttpOnly session cookie has actually been cleared,
      // eliminating the login <-> dashboard redirect race.
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
    } catch {
      // Local session is already cleared. Even when the network is unavailable,
      // allow the UI to reach the login page instead of trapping the user.
    }
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
