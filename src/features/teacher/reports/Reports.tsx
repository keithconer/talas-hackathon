/** Teacher reports landing. Aggregated class-level reading progress reports. */
function Reports() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-gray-500">
          Class-level progress and diagnostic summaries.
        </p>
      </header>

      <div className="p-8 rounded-xl bg-white shadow-sm text-center">
        <p className="text-gray-500">No reports available yet.</p>
        <p className="text-sm text-gray-500 mt-1">
          Reports will be generated once assessments have been completed.
        </p>
      </div>
    </div>
  )
}

export default Reports
