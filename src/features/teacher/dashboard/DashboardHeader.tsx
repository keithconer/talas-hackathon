/** Greeting + context header for the teacher dashboard (mockup-styled). */
function DashboardHeader() {
  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 12 ? 'Magandang umaga' : hour < 18 ? 'Magandang hapon' : 'Magandang gabi'

  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <header className="space-y-1">
      <h1 className="font-display text-xl sm:text-2xl font-bold text-charcoal tracking-tight">
        {greeting}, Teacher Maria{' '}
      </h1>
      <p className="font-reading text-xs text-gray-500 max-w-2xl">
        {dateLabel}
      </p>
    </header>
  )
}

export default DashboardHeader
