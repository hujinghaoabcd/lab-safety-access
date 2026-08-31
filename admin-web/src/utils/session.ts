let known = false
let authenticated = false
let inFlight: Promise<boolean> | null = null

export const markAdminSession = (value: boolean) => {
  known = true
  authenticated = value
}

export const clearAdminSession = () => {
  markAdminSession(false)
}

export const checkAdminSession = async ({ force = false } = {}) => {
  if (!force && known) return authenticated
  if (!force && inFlight) return inFlight

  inFlight = fetch('/api/admin/session', {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' }
  })
    .then((response) => {
      const valid = response.ok
      markAdminSession(valid)
      return valid
    })
    .catch(() => {
      markAdminSession(false)
      return false
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}
