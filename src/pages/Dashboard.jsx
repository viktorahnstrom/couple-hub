import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, isToday, isTomorrow } from 'date-fns'
import { sv } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import EventModal from '../components/EventModal'

// ─── Widget definitions ──────────────────────────────────────────────────────

const WIDGET_DEFS = [
  { id: 'events',     label: 'Kommande händelser', emoji: '📅' },
  { id: 'budget',     label: 'Budget denna månad', emoji: '💰' },
  { id: 'shopping',   label: 'Inköpslista',        emoji: '🛒' },
  { id: 'quicklinks', label: 'Snabblänkar',         emoji: '⚡' },
]

const DEFAULT_CONFIG = {
  order:  ['events', 'budget', 'shopping', 'quicklinks'],
  hidden: [],
}

function loadConfig() {
  try {
    const raw = localStorage.getItem('ch_dashboard')
    if (!raw) return DEFAULT_CONFIG
    const parsed = JSON.parse(raw)
    // Ensure any newly added widget ids are included in order
    const existingIds = parsed.order || []
    const allIds = WIDGET_DEFS.map(w => w.id)
    const merged = [...existingIds, ...allIds.filter(id => !existingIds.includes(id))]
    return { order: merged, hidden: parsed.hidden || [] }
  } catch {
    return DEFAULT_CONFIG
  }
}

function saveConfig(cfg) {
  localStorage.setItem('ch_dashboard', JSON.stringify(cfg))
}

// ─── Quick links config ───────────────────────────────────────────────────────

const QUICK_LINKS = [
  { emoji: '📅', label: 'Kalender',    to: '/calendar' },
  { emoji: '💰', label: 'Ekonomi',     to: '/economy'  },
  { emoji: '🛒', label: 'Handel',      to: '/shopping' },
  { emoji: '🎬', label: 'Film & serier', to: '/titles' },
  { emoji: '🍳', label: 'Recept',      to: '/recipes'  },
  { emoji: '⚙️', label: 'Inställningar', to: '/more'  },
]

// ─── Main component ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const { profile } = useAuth()
  const { household, members } = useHousehold()

  const [events, setEvents]           = useState([])
  const [shoppingItems, setShoppingItems] = useState([])
  const [monthStats, setMonthStats]   = useState({ spent: 0, budget: 0 })
  const [loading, setLoading]         = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [widgetConfig, setWidgetConfig]   = useState(loadConfig)
  const [editMode, setEditMode]           = useState(false)

  useEffect(() => {
    if (!household) return
    fetchAll()
  }, [household])

  async function fetchAll() {
    const now          = new Date().toISOString()
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString().split('T')[0]

    const [eventsRes, listRes, expensesRes, categoriesRes] = await Promise.all([
      supabase
        .from('calendar_events')
        .select('*, creator:profiles!created_by(name)')
        .eq('household_id', household.id)
        .gte('start_time', now)
        .order('start_time')
        .limit(3),

      supabase
        .from('shopping_lists')
        .select('id')
        .eq('household_id', household.id)
        .order('created_at', { ascending: false })
        .limit(1),

      supabase
        .from('expenses')
        .select('amount')
        .eq('household_id', household.id)
        .gte('date', startOfMonth),

      supabase
        .from('budget_categories')
        .select('monthly_limit')
        .eq('household_id', household.id),
    ])

    setEvents(eventsRes.data || [])

    if (listRes.data?.[0]) {
      const { data: items } = await supabase
        .from('shopping_items')
        .select('*')
        .eq('list_id', listRes.data[0].id)
        .order('created_at')
        .limit(5)
      setShoppingItems(items || [])
    }

    const spent  = (expensesRes.data  || []).reduce((s, e) => s + Number(e.amount),        0)
    const budget = (categoriesRes.data || []).reduce((s, c) => s + Number(c.monthly_limit), 0)
    setMonthStats({ spent, budget })
    setLoading(false)
  }

  // Optimistic toggle for shopping items
  async function toggleItem(item) {
    const next = !item.checked
    setShoppingItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: next } : i))
    await supabase.from('shopping_items').update({ checked: next }).eq('id', item.id)
  }

  async function deleteEvent(id) {
    setSelectedEvent(null)
    await supabase.from('calendar_events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  // Widget config helpers
  function toggleWidget(id) {
    const cfg = { ...widgetConfig }
    cfg.hidden = cfg.hidden.includes(id)
      ? cfg.hidden.filter(h => h !== id)
      : [...cfg.hidden, id]
    setWidgetConfig(cfg)
    saveConfig(cfg)
  }

  function moveWidget(id, dir) {
    const order = [...widgetConfig.order]
    const idx   = order.indexOf(id)
    const next  = idx + dir
    if (next < 0 || next >= order.length) return
    ;[order[idx], order[next]] = [order[next], order[idx]]
    const cfg = { ...widgetConfig, order }
    setWidgetConfig(cfg)
    saveConfig(cfg)
  }

  function formatEventDate(dateStr) {
    const d = new Date(dateStr)
    if (isToday(d))    return 'Idag'
    if (isTomorrow(d)) return 'Imorgon'
    return format(d, 'EEE d MMM', { locale: sv })
  }

  const hour     = new Date().getHours()
  const greeting = hour < 5 ? 'God natt' : hour < 12 ? 'God morgon' : hour < 17 ? 'Hej' : 'God kväll'
  const partner  = members.find(m => m.user_id !== profile?.id)?.profiles
  const spentPct = monthStats.budget > 0
    ? Math.min((monthStats.spent / monthStats.budget) * 100, 100) : 0

  const visibleWidgets = widgetConfig.order.filter(id => !widgetConfig.hidden.includes(id))

  if (loading) return <DashboardSkeleton />

  // ─── Widget renderers ─────────────────────────────────────────────────────

  function renderWidget(id) {
    if (id === 'events') return (
      <Section key="events" title="Kommande händelser" linkTo="/calendar" linkLabel="Se alla">
        {events.length === 0 ? (
          <EmptyCard emoji="📅" text="Inga kommande händelser">
            <Link to="/calendar" className="text-primary-600 text-sm font-semibold mt-2 block">
              + Lägg till händelse
            </Link>
          </EmptyCard>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {events.map((ev, i) => (
              <button
                key={ev.id}
                onClick={() => setSelectedEvent(ev)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 transition-colors ${
                  i < events.length - 1 ? 'border-b border-gray-50' : ''
                }`}
              >
                {/* Color icon */}
                <div
                  className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center"
                  style={{ background: (ev.color || '#7C3AED') + '20' }}
                >
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: ev.color || '#7C3AED' }} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{ev.title}</p>
                  {ev.description
                    ? <p className="text-xs text-gray-400 truncate mt-0.5">{ev.description}</p>
                    : ev.all_day
                      ? <p className="text-xs text-gray-300 mt-0.5">Heldag</p>
                      : null
                  }
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-medium text-gray-500">{formatEventDate(ev.start_time)}</p>
                  {!ev.all_day && (
                    <p className="text-xs text-gray-300 mt-0.5">
                      {format(new Date(ev.start_time), 'HH:mm')}
                    </p>
                  )}
                </div>

                <svg className="text-gray-200 flex-shrink-0 ml-1" width="14" height="14" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            ))}
          </div>
        )}
      </Section>
    )

    if (id === 'budget') return (
      <Section key="budget" title="Budget denna månad" linkTo="/economy" linkLabel="Detaljer">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          {monthStats.budget === 0 ? (
            <EmptyCard emoji="💰" text="Ingen budget satt än">
              <Link to="/economy" className="text-primary-600 text-sm font-semibold mt-2 block">
                + Sätt budget
              </Link>
            </EmptyCard>
          ) : (
            <>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.round(monthStats.budget - monthStats.spent).toLocaleString('sv-SE')} kr
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    kvar av {Math.round(monthStats.budget).toLocaleString('sv-SE')} kr
                  </p>
                </div>
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                  spentPct > 90 ? 'bg-red-50 text-red-600' :
                  spentPct > 70 ? 'bg-amber-50 text-amber-600' :
                                  'bg-green-50 text-green-600'
                }`}>
                  {Math.round(spentPct)}% spenderat
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    spentPct > 90 ? 'bg-red-400' :
                    spentPct > 70 ? 'bg-amber-400' :
                                    'bg-green-400'
                  }`}
                  style={{ width: `${spentPct}%` }}
                />
              </div>
            </>
          )}
        </div>
      </Section>
    )

    if (id === 'shopping') return (
      <Section key="shopping" title="Inköpslista" linkTo="/shopping" linkLabel="Se alla">
        {shoppingItems.length === 0 ? (
          <EmptyCard emoji="🛒" text="Listan är tom">
            <Link to="/shopping" className="text-primary-600 text-sm font-semibold mt-2 block">
              + Lägg till varor
            </Link>
          </EmptyCard>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {shoppingItems.map((item, i) => (
              <button
                key={item.id}
                onClick={() => toggleItem(item)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 transition-colors ${
                  i < shoppingItems.length - 1 ? 'border-b border-gray-50' : ''
                }`}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                  item.checked ? 'bg-green-500 border-green-500' : 'border-gray-300'
                }`}>
                  {item.checked && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className={`flex-1 text-sm transition-all ${
                  item.checked ? 'line-through text-gray-300' : 'text-gray-900'
                }`}>
                  {item.name}
                </span>
                {item.quantity && (
                  <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                    {item.quantity}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </Section>
    )

    if (id === 'quicklinks') return (
      <Section key="quicklinks" title="Snabblänkar">
        <div className="grid grid-cols-2 gap-2.5">
          {QUICK_LINKS.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className="bg-white rounded-2xl shadow-sm px-4 py-3.5 flex items-center gap-3 active:scale-[0.96] transition-all"
            >
              <span className="text-xl">{link.emoji}</span>
              <span className="text-sm font-medium text-gray-700">{link.label}</span>
            </Link>
          ))}
        </div>
      </Section>
    )

    return null
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">{greeting}</p>
          <h1 className="text-xl font-bold text-gray-900">{profile?.name} 👋</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMode(true)}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 active:scale-90 transition-all"
            title="Anpassa startsida"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <div className="flex -space-x-2">
            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 border-2 border-white z-10">
              {profile?.name?.[0]?.toUpperCase()}
            </div>
            {partner && (
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700 border-2 border-white">
                {partner.name?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Widgets */}
      {visibleWidgets.map(id => renderWidget(id))}

      {/* Event detail modal */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={deleteEvent}
        />
      )}

      {/* Customize sheet */}
      {editMode && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end z-[60] animate-fadeIn"
          onClick={() => setEditMode(false)}
        >
          <div
            className="bg-white w-full max-w-md mx-auto rounded-t-3xl animate-slideUp"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-2">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Anpassa startsida</h3>
                <p className="text-xs text-gray-400 mt-0.5">Välj vilka widgets som visas</p>
              </div>
              <button
                onClick={() => setEditMode(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 active:scale-90 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="px-4 py-4 pb-10 space-y-2">
              {widgetConfig.order.map((id, idx) => {
                const def      = WIDGET_DEFS.find(w => w.id === id)
                if (!def) return null
                const isHidden = widgetConfig.hidden.includes(id)

                return (
                  <div
                    key={id}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-all ${
                      isHidden ? 'bg-gray-50 opacity-50' : 'bg-gray-50'
                    }`}
                  >
                    <span className="text-xl">{def.emoji}</span>
                    <span className="flex-1 text-sm font-medium text-gray-700">{def.label}</span>

                    <div className="flex items-center gap-1.5">
                      {/* Move up */}
                      <button
                        onClick={() => moveWidget(id, -1)}
                        disabled={idx === 0}
                        className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-gray-400 disabled:opacity-20 active:scale-90 transition-all shadow-sm"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 15l-6-6-6 6"/>
                        </svg>
                      </button>
                      {/* Move down */}
                      <button
                        onClick={() => moveWidget(id, 1)}
                        disabled={idx === widgetConfig.order.length - 1}
                        className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-gray-400 disabled:opacity-20 active:scale-90 transition-all shadow-sm"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </button>
                      {/* Toggle switch */}
                      <button
                        onClick={() => toggleWidget(id)}
                        className={`w-12 h-6 rounded-full transition-all duration-200 ${
                          isHidden ? 'bg-gray-200' : 'bg-primary-600'
                        }`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 mx-0.5 ${
                          isHidden ? 'translate-x-0' : 'translate-x-6'
                        }`} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="pb-6 animate-pulse">
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div>
          <div className="h-3 w-16 bg-gray-200 rounded-full mb-2" />
          <div className="h-6 w-36 bg-gray-200 rounded-full" />
        </div>
        <div className="flex -space-x-2">
          <div className="w-9 h-9 rounded-full bg-gray-200 border-2 border-white" />
          <div className="w-9 h-9 rounded-full bg-gray-200 border-2 border-white" />
        </div>
      </div>
      {[80, 56, 96].map((h, i) => (
        <div key={i} className="px-5 mt-5">
          <div className="h-3 w-32 bg-gray-200 rounded-full mb-3" />
          <div className={`bg-white rounded-2xl shadow-sm`} style={{ height: h }} />
        </div>
      ))}
    </div>
  )
}

function Section({ title, linkTo, linkLabel, children }) {
  return (
    <div className="px-5 mt-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
        {linkTo && (
          <Link to={linkTo} className="text-xs text-primary-600 font-semibold">{linkLabel}</Link>
        )}
      </div>
      {children}
    </div>
  )
}

function EmptyCard({ emoji, text, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
      {emoji && <p className="text-2xl mb-2">{emoji}</p>}
      <p className="text-gray-400 text-sm">{text}</p>
      {children}
    </div>
  )
}
