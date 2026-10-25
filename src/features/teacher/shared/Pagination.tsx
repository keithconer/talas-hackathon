import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
}

/** Compact pagination shared by teacher record lists. */
export default function Pagination({ total, page, pageSize, onPageChange }: PaginationProps) {
  if (total === 0) return null

  const pageCount = Math.ceil(total / pageSize)
  const currentPage = Math.min(Math.max(page, 1), pageCount)
  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, total)

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 font-sans text-xs text-gray-500"
    >
      <span>Showing {start}–{end} of {total}</span>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous page"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 font-medium text-charcoal transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Previous
          </button>
          <span aria-live="polite" className="min-w-12 px-2 text-center tabular-nums">
            {currentPage} / {pageCount}
          </span>
          <button
            type="button"
            aria-label="Next page"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === pageCount}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 font-medium text-charcoal transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  )
}
