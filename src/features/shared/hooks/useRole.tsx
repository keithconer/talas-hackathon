import { useLocation } from 'react-router-dom'

export type Role = 'teacher' | 'learner'

/**
 * Derives the active role from the current route. `/teacher/*` -> teacher,
 * `/learner/*` -> learner. Defaults to teacher elsewhere. Lightweight stand-in
 * until real auth/session wiring exists.
 */
export function useRole(): Role {
  const { pathname } = useLocation()
  if (pathname.startsWith('/learner')) return 'learner'
  return 'teacher'
}
