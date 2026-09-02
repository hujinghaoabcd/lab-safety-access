let known = false
let authenticated = false
let inFlight: Promise<boolean> | null = null
let routeHoldUntil = 0

const waitForRouteHold = async () => {
  const remaining = routeHoldUntil - Date.now()
  if (remaining <= 0) return
  await new Promise<void>((resolve) => window.setTimeout(resolve, remaining))
}

export const markStudentSession = (value: boolean) => {
  known = true
  authenticated = value
  if (value) routeHoldUntil = 0
}

export const clearStudentSession = ({ routeHoldMs = 0 } = {}) => {
  known = true
  authenticated = false
  if (routeHoldMs > 0) {
    routeHoldUntil = Math.max(routeHoldUntil, Date.now() + routeHoldMs)
  }
}

export const checkStudentSession = async ({ force = false } = {}) => {
  // During an explicit mobile logout, Vant's confirmation dialog is still
  // finishing its leave transition for a few hundred milliseconds. Holding
  // the route guard here keeps that white overlay on the current page instead
  // of letting it flash over the freshly rendered login page.
  if (!force && known && !authenticated) {
    await waitForRouteHold()
    return false
  }

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
