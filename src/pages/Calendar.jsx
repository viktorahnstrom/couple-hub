import { useEffect, useState } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay, isToday,
  addMonths, subMonths
} from 'date-fns'
import { sv } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../contexts/HouseholdContext'
import { useAuth } from '../contexts/AuthContext'
import EventModal from '../components/EventModal'

const EVENT_COLORS = [
  '#7C3AED', // purple
  '#1D9E75', // green
  '#2563EB', // blue
  '#DC2626', // red
  '#D97706', // amber
  '#DB2777', // pink
]

const WEEKDAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

export default function Calendar() {
  const { household } = useHousehold()
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [events, setEvents] = useState([])
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    title: '', description: '',
    start_time: '', end_time: '',
    all_day: false, color: EVENT_COLORS[0]
  })

  useEffect(() => {
    if (!household) return
    fetchEvents()
  }, [household, currentDate])

  async function fetchEvents() {
    setLoading(true)
    const start = startOfMonth(currentDate).toISOString()
    const end = endOfMonth(currentDate).toISOString()
    const { data } = await supabase
      .from('calendar_events')
      .select('*, creator:profiles!created_by(name)')
      .eq('household_id', household.id)
      .gte('start_time', start)
      .lte('start_time', end)
      .order('start_time')
    setEvents(data || [])
    setLoading(false)
  }

  async function addEvent(e) {
    e.preventDefault()
    const start = new Date(form.start_time).toISOString()
    const end = form.all_day
      ? start
      : new Date(form.end_time || form.start_time).toISOString()

    await supabase.from('calendar_events').insert({
      household_id: household.id,
      created_by: user.id,
      title: form.title,
      description: form.description || null,
      start_time: start,
      end_time: end,
      all_day: form.all_day,
      color: form.color
    })

    setForm({
      title: '', description: '', start_time: '',
      end_time: '', all_day: false, color: EVENT_COLORS[0]
    })
    setShowAddEvent(false)
    fetchEvents()
  }

  async function deleteEvent(id) {
    setSelectedEvent(null)
    await supabase.from('calendar_events').delete().eq('id', id)
    fetchEvents()
  }

  function openAddForDay(day) {
    const dateStr = format(day, 'yyyy-MM-dd')
    setForm(prev => ({
      ...prev,
      start_time: `${dateStr}T09:00`,
      end_time: `${dateStr}T10:00`
    }))
    setSelectedDay(day)
    setShowAddEvent(true)
  }

  // Build the 6-row calendar grid
  const monthStart = startOfMonth(currentDate)
  const monthEnd   = endOfMonth(currentDate)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd    = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = []
  let cursor = gridStart
  while (cursor <= gridEnd) {
    days.push(new Date(cursor))
    cursor = addDays(cursor, 1)
  }

  const selectedDayEvents = events.filter(ev =>
    isSameDay(new Date(ev.start_time), selectedDay)
  )

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900 capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: sv })}
          </h1>
          <button
            onClick={() => setShowAddEvent(true)}
            className="bg-primary-600 text-white rounded-full px-4 py-1.5 text-sm font-medium"
          >
            + Händelse
          </button>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg"
          >
            ‹
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-xs text-primary-600 font-medium"
          >
            Idag
          </button>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg"
          >
            ›
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-y-0.5">
            {days.map((day, i) => {
              const dayEvents    = events.filter(ev => isSameDay(new Date(ev.start_time), day))
              const isSelected   = isSameDay(day, selectedDay)
              const inThisMonth  = isSameMonth(day, currentDate)
              const todayFlag    = isToday(day)

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(day)}
                  onDoubleClick={() => openAddForDay(day)}
                  className={`relative flex flex-col items-center py-1.5 rounded-xl transition ${
                    isSelected
                      ? 'bg-primary-600'
                      : todayFlag
                      ? 'bg-primary-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`text-xs font-medium ${
                    isSelected    ? 'text-white' :
                    todayFlag     ? 'text-primary-600' :
                    inThisMonth   ? 'text-gray-900' :
                                    'text-gray-300'
                  }`}>
                    {format(day, 'd')}
                  </span>

                  {/* Event dots */}
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 h-1">
                      {dayEvents.slice(0, 3).map((ev, j) => (
                        <div
                          key={j}
                          className="w-1 h-1 rounded-full"
                          style={{ background: isSelected ? 'rgba(255,255,255,0.7)' : ev.color }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Selected day */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 capitalize tracking-wider">
            {isToday(selectedDay)
              ? 'Idag'
              : format(selectedDay, 'EEEE d MMMM', { locale: sv })}
          </p>
          <button
            onClick={() => openAddForDay(selectedDay)}
            className="text-xs text-primary-600 font-medium"
          >
            + Lägg till
          </button>
        </div>

        {selectedDayEvents.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">📅</p>
            <p className="text-gray-400 text-sm">Inga händelser den här dagen</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedDayEvents.map(ev => (
              <button
                key={ev.id}
                onClick={() => setSelectedEvent(ev)}
                className="w-full bg-white rounded-2xl shadow-sm px-4 py-3.5 flex items-stretch gap-3 text-left active:scale-[0.98] transition-all"
              >
                {/* Color bar */}
                <div
                  className="w-1 rounded-full flex-shrink-0"
                  style={{ background: ev.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{ev.title}</p>
                  {ev.description && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{ev.description}</p>
                  )}
                  {!ev.all_day && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(new Date(ev.start_time), 'HH:mm')} –{' '}
                      {format(new Date(ev.end_time), 'HH:mm')}
                    </p>
                  )}
                  {ev.all_day && (
                    <p className="text-xs text-gray-300 mt-0.5">Heldag</p>
                  )}
                  {ev.creator?.name && (
                    <p className="text-[10px] text-gray-300 mt-1">
                      Tillagd av {ev.creator.name}
                    </p>
                  )}
                </div>
                <svg className="text-gray-200 self-center flex-shrink-0" width="14" height="14"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Event detail modal */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={deleteEvent}
        />
      )}

      {/* Add Event Modal */}
      {showAddEvent && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end z-[60] animate-fadeIn"
          onClick={() => setShowAddEvent(false)}
        >
          <div
            className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto animate-slideUp"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Ny händelse</h3>
              <button
                onClick={() => setShowAddEvent(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 active:scale-90 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <form onSubmit={addEvent} className="space-y-3">
              <input
                type="text"
                placeholder="Titel"
                required
                autoFocus
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500"
              />

              <input
                type="text"
                placeholder="Beskrivning (valfritt)"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500"
              />

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.all_day}
                  onChange={e => setForm(p => ({ ...p, all_day: e.target.checked }))}
                  className="rounded accent-primary-600"
                />
                Heldag
              </label>

              {form.all_day ? (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Datum</p>
                  <input
                    type="date"
                    required
                    value={form.start_time.split('T')[0]}
                    onChange={e => setForm(p => ({
                      ...p,
                      start_time: e.target.value + 'T00:00',
                      end_time: e.target.value + 'T23:59'
                    }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Start</p>
                    <input
                      type="datetime-local"
                      required
                      value={form.start_time}
                      onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Slut</p>
                    <input
                      type="datetime-local"
                      required
                      value={form.end_time}
                      onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              )}

              {/* Color picker */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Färg</p>
                <div className="flex gap-2 flex-wrap">
                  {EVENT_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, color: c }))}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        form.color === c ? 'border-gray-800 scale-110' : 'border-transparent'
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-primary-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-primary-700 transition"
              >
                Spara händelse
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
