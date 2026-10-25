import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Sparkles,
  FileBarChart,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import { clearTeacherAuth } from '../../auth/teacherSession'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const TEACHER_NAV: NavItem[] = [
  { to: '/teacher', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/teacher/learners', label: 'Learners', icon: Users },
  { to: '/teacher/interventions', label: 'Intervention', icon: Sparkles },
  { to: '/teacher/reports', label: 'Reports', icon: FileBarChart },
]

/**
 * App shell for the teacher area: a horizontal top navigation bar with the
 * active page rendered full-width (centered, max-width) through <Outlet />.
 * Pages supply their own content only.
 */
function AppLayout() {
  const navigate = useNavigate()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const confirmLogout = () => {
    clearTeacherAuth()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-paper text-charcoal">
      {/* Top navigation */}
      <header className="sticky top-0 z-40 bg-paper/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Brand + profile row */}
          <div className="h-16 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigate('/teacher')}
              className="flex items-center gap-2 shrink-0"
            >
              <img
                src="/imgs/talasLogo.png"
                alt=""
                aria-hidden="true"
                className="h-9 w-9 object-contain [image-rendering:pixelated]"
              />
              <span className="font-display text-lg font-bold text-charcoal">TALAS</span>
              <span className="hidden sm:inline font-sans text-sm text-gray-400">
                · Basa &amp; Tuklas
              </span>
            </button>

            {/* Primary nav — inline on desktop */}
            <nav
              className="hidden lg:flex items-center gap-1"
              aria-label="Teacher navigation"
            >
              {TEACHER_NAV.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2 rounded-xl font-sans text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-sprout-50 text-sprout-500'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-charcoal'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" aria-hidden />
                    {item.label}
                  </NavLink>
                )
              })}
            </nav>

            <div className="flex items-center gap-3 shrink-0">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sprout-50 text-sprout-500 font-sans text-xs font-semibold">
                SY 2026–2027
              </span>
              <span className="flex items-center gap-2">
                <span className="hidden md:flex flex-col leading-tight text-right">
                  <span className="font-sans text-sm font-semibold text-charcoal">Teacher Maria</span>
                  <span className="font-sans text-xs text-gray-400">Grades 1–3</span>
                </span>
                <span className="w-9 h-9 rounded-full bg-sprout-500 text-white flex items-center justify-center font-sans font-bold">
                  M
                </span>
              </span>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 font-sans text-sm text-charcoal transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" aria-hidden />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </div>
          </div>

          {/* Primary nav — scrollable row on tablet/mobile */}
          <nav
            className="lg:hidden flex items-center gap-1 pb-2 -mt-1 overflow-x-auto"
            aria-label="Teacher navigation"
          >
            {TEACHER_NAV.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-xl font-sans text-sm font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-sprout-50 text-sprout-500'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-charcoal'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" aria-hidden />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Full-width centered content */}
      <main className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
        <Outlet />
      </main>

      {/* Log out confirmation modal */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
          aria-describedby="logout-desc"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Cancel log out"
            onClick={() => setShowLogoutConfirm(false)}
            className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm"
          />

          {/* Dialog */}
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-coral-50 text-coral-500 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5" aria-hidden />
              </span>
              <h2 id="logout-title" className="font-display text-lg font-bold text-charcoal">
                Log out of TALAS?
              </h2>
            </div>
            <p id="logout-desc" className="font-sans text-sm text-gray-500 leading-relaxed">
              You will be returned to the sign-in screen. Any unsaved work on the current
              page may be lost.
            </p>
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="h-10 px-4 rounded-xl bg-paper border border-gray-200 hover:bg-gray-50 text-charcoal font-sans text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                className="h-10 px-4 rounded-xl bg-coral-500 hover:opacity-95 text-white font-sans text-sm font-semibold inline-flex items-center gap-1.5 transition-all shadow-sm"
              >
                <LogOut className="w-4 h-4" aria-hidden />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AppLayout
