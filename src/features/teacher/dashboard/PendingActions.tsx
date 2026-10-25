function PendingActions() {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-charcoal">Pending Actions</h2>
      </div>

      <div className="py-8 text-center">
        <p className="font-sans text-sm text-gray-500">No pending actions.</p>
      </div>
    </section>
  )
}

export default PendingActions
