import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import './RoleSelector.css'

const ROLE_CARDS = [
  {
    role: 'teacher',
    title: 'Teacher',
    blurb: 'assign assessments, review learner work, and track progress',
    action: 'Teacher',
    to: '/teacher',
  },
  {
    role: 'student',
    title: 'Student',
    blurb: 'complete your assigned work, practice, and grow your streak.',
    action: 'Student',
    to: '/learner/home',
  },
] as const

/** Landing / role-selection screen. Entry point of the app at `/`. */
function RoleSelector() {
  const navigate = useNavigate()

  return (
    <main className="landing-page">
      <img className="landing-decor landing-cloud landing-cloud--left" src="/imgs/left-cloud.svg" alt="" aria-hidden="true" />
      <img className="landing-decor landing-cloud landing-cloud--right" src="/imgs/right-cloud.svg" alt="" aria-hidden="true" />
      <img className="landing-decor landing-spark landing-spark--left" src="/imgs/left-spark.svg" alt="" aria-hidden="true" />
      <img className="landing-decor landing-spark landing-spark--right" src="/imgs/right-spark.svg" alt="" aria-hidden="true" />
      <img className="landing-decor landing-grass landing-grass--left" src="/imgs/left-grass.svg" alt="" aria-hidden="true" />
      <img className="landing-decor landing-grass landing-grass--right" src="/imgs/right-grass.svg" alt="" aria-hidden="true" />

      <div className="landing-content">
        <header className="landing-hero">
          <picture className="landing-mascot">
            <source media="(prefers-reduced-motion: reduce)" srcSet="/imgs/talasLogo.svg" />
            <img src="/imgs/talas-blinking.gif" alt="TALAS frog mascot" />
          </picture>
          <h1>
            <span>Teaching &amp; Learning,</span>
            <span>
              assessed with <strong>care.</strong>
            </span>
          </h1>
          <p>choose your role to get started with TALAS</p>
        </header>

        <section className="landing-roles" aria-label="Choose your role">
          {ROLE_CARDS.map((card) => (
            <button
              key={card.role}
              type="button"
              onClick={() => navigate(card.to)}
              className={`landing-role-card landing-role-card--${card.role}`}
            >
              <span className="landing-role-card__title">{card.title}</span>
              <span className="landing-role-card__description">{card.blurb}</span>
              <span className="landing-role-card__action">
                {card.action}
                <ArrowRight aria-hidden="true" />
              </span>
            </button>
          ))}
        </section>
      </div>
    </main>
  )
}

export default RoleSelector
