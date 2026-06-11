const ADMIN_TOKEN_KEY = 'f1replay.adminToken'

// The operator's admin secret for a hosted deployment. It is stored locally on
// the operator's own device and sent as X-Admin-Token on the F1TV auth calls
// that the backend gates behind ADMIN_TOKEN. Visitors never set this.
export function getAdminToken(): string {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setAdminToken(token: string): void {
  try {
    const value = token.trim()
    if (value) {
      localStorage.setItem(ADMIN_TOKEN_KEY, value)
    } else {
      localStorage.removeItem(ADMIN_TOKEN_KEY)
    }
  } catch {
    /* storage unavailable; calls will fail the admin check and report it */
  }
}

export function adminHeaders(): Record<string, string> {
  const token = getAdminToken()
  return token ? { 'X-Admin-Token': token } : {}
}
