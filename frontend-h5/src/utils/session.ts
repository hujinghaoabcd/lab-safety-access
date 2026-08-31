let known = false
let authenticated = false
let inFlight: Promise<boolean> | null = null

export const markStudentSession = (value: boolean) => {
  known = true
  authenticated = value
}

export const clearStudentSession = () => {
  markStudentSession(false)
}

export const checkStudentSession = async ({ force = false } = {}) => {
  if (!force && known) return authenticated
  if (!force && inFlight) return inFlight

  inFlight = fetch('/api/user/profile', {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' }
  })
    .then((response) => {
      const valid = response.ok
      markStudentSession(valid)
      return valid
    })
    .catch(() => {
      markStudentSession(false)
      return false
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}
