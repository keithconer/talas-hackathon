/**
 * Teacher PIN gate (mock auth).
 *
 * No backend yet: a single demo PIN protects the teacher area. Successful
 * entry is remembered in sessionStorage so navigating between teacher routes
 * (and refreshing the page) stays authenticated, while closing the tab ends
 * the session. Swap `TEACHER_PIN` / these helpers for real auth later without
 * touching the components that call them.
 */

const STORAGE_KEY = 'talas.teacher.authed'

/** Demo PIN distributed to the teacher. */
export const TEACHER_PIN = '1234'

/** Length of the PIN, used to size the input UI. */
export const TEACHER_PIN_LENGTH = TEACHER_PIN.length

/** True once the teacher has entered the correct PIN this session. */
export function isTeacherAuthed(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/** Validates a PIN; on success, marks the session authenticated. */
export function verifyTeacherPin(pin: string): boolean {
  const ok = pin === TEACHER_PIN
  if (ok) {
    try {
      sessionStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      /* ignore storage failures — auth still holds for this render */
    }
  }
  return ok
}

/** Clears the teacher session (log out). */
export function clearTeacherAuth(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
