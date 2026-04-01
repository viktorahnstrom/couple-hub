import { format, isToday, isTomorrow } from 'date-fns'
import { sv } from 'date-fns/locale'

export default function EventModal({ event, onClose, onDelete }) {
  if (!event) return null

  function formatDate(dateStr) {
    const d = new Date(dateStr)
    if (isToday(d)) return 'Idag'
    if (isTomorrow(d)) return 'Imorgon'
    return format(d, 'EEEE d MMMM', { locale: sv })
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end z-[60] animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md mx-auto rounded-t-3xl overflow-hidden animate-slideUp"
        onClick={e => e.stopPropagation()}
      >
        {/* Color accent strip */}
        <div className="h-1.5 w-full" style={{ background: event.color || '#7C3AED' }} />

        <div className="p-6">
          {/* Title row */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl"
                style={{ background: (event.color || '#7C3AED') + '22' }}
              >
                📅
              </div>
              <h2 className="text-lg font-bold text-gray-900 leading-snug">{event.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 ml-3 flex-shrink-0 active:scale-90 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Date & time */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 capitalize">{formatDate(event.start_time)}</p>
                {event.all_day ? (
                  <p className="text-xs text-gray-400 mt-0.5">Heldag</p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(event.start_time), 'HH:mm')} – {format(new Date(event.end_time), 'HH:mm')}
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            {event.description && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6"/>
                    <line x1="8" y1="12" x2="21" y2="12"/>
                    <line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/>
                    <line x1="3" y1="12" x2="3.01" y2="12"/>
                    <line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mt-1">{event.description}</p>
              </div>
            )}

            {/* Creator */}
            {event.creator?.name && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <p className="text-sm text-gray-600">
                  Tillagd av <span className="font-semibold text-gray-800">{event.creator.name}</span>
                </p>
              </div>
            )}
          </div>

          {onDelete && (
            <button
              onClick={() => onDelete(event.id)}
              className="mt-6 w-full py-3.5 text-sm text-red-500 font-semibold bg-red-50 rounded-2xl hover:bg-red-100 active:scale-[0.97] transition-all"
            >
              Ta bort händelse
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
