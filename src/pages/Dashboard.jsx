import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, isToday, isTomorrow } from 'date-fns'
import { sv } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'

export default function Dashboard() {
  const { profile } = useAuth()
  const { household, members } = useHousehold()
  const [events, setEvents] = useState([])
  const [shoppingItems, setShoppingItems] = useState([])
  const [monthStats, setMonthStats] = useState({ spent: 0, budget: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!household) return
    fetchAll()
  }, [household])

  async function fetchAll() {
    const now = new Date().toISOString()
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    ).toISOString().split('T')[0]

    const [eventsRes, listRes, expensesRes, categoriesRes] = await Promise.all([
      supabase
        .from('calendar_events')
        .select('*')
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
        .eq('household_id', household.id)
    ])

    setEvents(eventsRes.data || [])

    // Fetch items from the most recent shopping list
    if (listRes.data?.[0]) {
      const { data: items } = await supabase
        .from('shopping_items')
        .select('*')
        .eq('list_id', listRes.data[0].id)
        .order('created_at')
        .limit(5)
      setShoppingItems(items || [])
    }

    const spent = (expensesRes.data || []).reduce((sum, e) => sum + Number(e.amount), 0)
    const budget = (categoriesRes.data || []).reduce((sum, c) => sum + Number(c.monthly_limit), 0)
    setMonthStats({ spent, budget })
    setLoading(false)
  }

  function formatEventDate(dateStr) {
    const d = new Date(dateStr)
    if (isToday(d)) return 'Idag'
    if (isTomorrow(d)) return 'Imorgon'
    return format(d, 'EEE d MMM', { locale: sv })
  }

  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'God natt' : hour < 12 ? 'God morgon' : hour < 17 ? 'Hej' : 'God kväll'
  const partner = members.find(m => m.user_id !== profile?.id)?.profiles
  const spentPct = monthStats.budget > 0
    ? Math.min((monthStats.spent / monthStats.budget) * 100, 100)
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">{greeting}</p>
          <h1 className="text-xl font-semibold text-gray-900">{profile?.name} 👋</h1>
        </div>
        <div className="flex -space-x-2">
          <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-xs font-semibold text-primary-700 border-2 border-white z-10">
            {profile?.name?.[0]?.toUpperCase()}
          </div>
          {partner && (
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-xs font-semibold text-green-700 border-2 border-white">
              {partner.name?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming events */}
      <Section title="Kommande händelser" linkTo="/calendar" linkLabel="Se alla">
        {events.length === 0 ? (
          <EmptyCard>
            <p className="text-gray-400 text-sm">Inga kommande händelser</p>
            <Link to="/calendar" className="text-primary-600 text-sm font-medium mt-1 block">
              + Lägg till händelse
            </Link>
          </EmptyCard>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {events.map((ev, i) => (
              <div
                key={ev.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i < events.length - 1 ? 'border-b border-gray-50' : ''
                }`}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: ev.color || '#7C3AED' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{ev.title}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-500">{formatEventDate(ev.start_time)}</p>
                  {!ev.all_day && (
                    <p className="text-xs text-gray-400">
                      {format(new Date(ev.start_time), 'HH:mm')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Budget */}
      <Section title="Budget denna månad" linkTo="/economy" linkLabel="Detaljer">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          {monthStats.budget === 0 ? (
            <div className="text-center">
              <p className="text-gray-400 text-sm">Ingen budget satt än</p>
              <Link to="/economy" className="text-primary-600 text-sm font-medium mt-1 block">
                + Sätt budget
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    {Math.round(monthStats.budget - monthStats.spent).toLocaleString('sv-SE')} kr
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    kvar av {Math.round(monthStats.budget).toLocaleString('sv-SE')} kr
                  </p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  spentPct > 90 ? 'bg-red-50 text-red-600' :
                  spentPct > 70 ? 'bg-amber-50 text-amber-600' :
                  'bg-green-50 text-green-600'
                }`}>
                  {Math.round(spentPct)}% spenderat
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
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

      {/* Shopping */}
      <Section title="Inköpslista" linkTo="/shopping" linkLabel="Se alla">
        {shoppingItems.length === 0 ? (
          <EmptyCard>
            <p className="text-gray-400 text-sm">Listan är tom</p>
            <Link to="/shopping" className="text-primary-600 text-sm font-medium mt-1 block">
              + Lägg till varor
            </Link>
          </EmptyCard>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {shoppingItems.map((item, i) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i < shoppingItems.length - 1 ? 'border-b border-gray-50' : ''
                }`}
              >
                <div className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center ${
                  item.checked ? 'bg-green-500 border-green-500' : 'border-gray-300'
                }`}>
                  {item.checked && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className={`flex-1 text-sm ${
                  item.checked ? 'line-through text-gray-300' : 'text-gray-900'
                }`}>
                  {item.name}
                </span>
                {item.quantity && (
                  <span className="text-xs text-gray-400">{item.quantity}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

// ─── Sub-components ────────────────────────

function Section({ title, linkTo, linkLabel, children }) {
  return (
    <div className="px-5 mt-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
        {linkTo && (
          <Link to={linkTo} className="text-xs text-primary-600 font-medium">{linkLabel}</Link>
        )}
      </div>
      {children}
    </div>
  )
}

function EmptyCard({ children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
      {children}
    </div>
  )
}
