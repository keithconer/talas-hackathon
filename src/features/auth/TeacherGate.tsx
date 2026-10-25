import { useState } from 'react'
import AppLayout from '../shared/components/AppLayout'
import TeacherAuth from './TeacherAuth'
import { isTeacherAuthed } from './teacherSession'

/**
 * Guards the whole teacher area. Until the teacher enters the correct PIN,
 * every `/teacher/*` route shows the PIN screen; once authenticated (persisted
 * in sessionStorage) the normal <AppLayout> shell + routed page renders.
 */
export default function TeacherGate() {
  const [authed, setAuthed] = useState(isTeacherAuthed)

  if (!authed) {
    return <TeacherAuth onSuccess={() => setAuthed(true)} />
  }

  return <AppLayout />
}
