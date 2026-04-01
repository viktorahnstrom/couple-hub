import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../contexts/HouseholdContext'
import { useAuth } from '../contexts/AuthContext'

const TABS = ['Serier', 'Program']

const STATUS_META = {
  watching: { label: 'Tittar på', cls: 'bg-green-100 text-green-700' },
  paused:   { label: 'Pausad',    cls: 'bg-amber-100 text-amber-700' },
  finished: { label: 'Klar',      cls: 'bg-gray-100 text-gray-500'  },
}

function Stars({ rating, onRate, muted }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onRate?.(n)}
          disabled={!onRate}
          className={`text-base leading-none transition-transform ${onRate ? 'active:scale-110' : ''}`}
        >
          <span className={n <= (rating || 0) ? (muted ? 'text-gray-400' : 'text-primary-500') : 'text-gray-200'}>
            ★
          </span>
        </button>
      ))}
    </div>
  )
}

export default function Titles() {
  const navigate = useNavigate()
  const { household, members } = useHousehold()
  const { user, profile } = useAuth()
  const [tab, setTab] = useState(0)
  const [titles, setTitles] = useState([])
  const [ratings, setRatings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState(null) // title being edited for episode progress

  const [form, setForm] = useState({
    title: '', type: 'series', status: 'watching',
    current_season: '1', current_episode: '1'
  })

  const type = tab === 0 ? 'series' : 'program'

  useEffect(() => {
    if (!household) return
    fetchAll()
  }, [household])

  async function fetchAll() {
    setLoading(true)
    const [titlesRes, ratingsRes] = await Promise.all([
      supabase
        .from('watch_titles')
        .select('*')
        .eq('household_id', household.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('watch_ratings')
        .select('*')
        .in('title_id', await getTitleIds()),
    ])
    setTitles(titlesRes.data || [])
    setRatings(ratingsRes.data || [])
    setLoading(false)
  }

  async function getTitleIds() {
    const { data } = await supabase
      .from('watch_titles')
      .select('id')
      .eq('household_id', household.id)
    return (data || []).map(t => t.id)
  }

  async function addTitle(e) {
    e.preventDefault()
    await supabase.from('watch_titles').insert({
      household_id: household.id,
      added_by: user.id,
      title: form.title,
      type: form.type,
      status: form.status,
      current_season: form.type === 'series' ? parseInt(form.current_season) || 1 : null,
      current_episode: form.type === 'series' ? parseInt(form.current_episode) || 1 : null,
    })
    setForm({ title: '', type: tab === 0 ? 'series' : 'program', status: 'watching', current_season: '1', current_episode: '1' })
    setShowAdd(false)
    fetchAll()
  }

  async function deleteTitle(id) {
    if (!confirm('Ta bort titeln?')) return
    await supabase.from('watch_titles').delete().eq('id', id)
    fetchAll()
  }

  async function rateTitle(titleId, rating) {
    await supabase.from('watch_ratings').upsert(
      { title_id: titleId, user_id: user.id, rating },
      { onConflict: 'title_id,user_id' }
    )
    fetchAll()
  }

  async function updateEpisode(title, field, value) {
    const parsed = parseInt(value)
    if (isNaN(parsed) || parsed < 1) return
    await supabase.from('watch_titles').update({ [field]: parsed }).eq('id', title.id)
    fetchAll()
  }

  async function updateStatus(title, status) {
    await supabase.from('watch_titles').update({ status }).eq('id', title.id)
    fetchAll()
  }

  function getRating(titleId, userId) {
    return ratings.find(r => r.title_id === titleId && r.user_id === userId)?.rating || 0
  }

  const partner = members.find(m => m.user_id !== user.id)
  const filtered = titles.filter(t => t.type === type)

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 pt-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/more')}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-xl"
            >
              ‹
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Film & Serier</h1>
          </div>
          <button
            onClick={() => {
              setForm({ title: '', type: type, status: 'watching', current_season: '1', current_episode: '1' })
              setShowAdd(true)
            }}
            className="bg-primary-600 text-white rounded-full px-4 py-1.5 text-sm font-medium"
          >
            + Lägg till
          </button>
        </div>

        {/* Tabs */}
        <div className="flex">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`flex-1 pb-3 text-sm font-medium border-b-2 transition ${
                tab === i
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">{tab === 0 ? '📺' : '🎬'}</p>
            <p className="text-gray-400 text-sm mb-3">
              {tab === 0 ? 'Inga serier ännu' : 'Inga program ännu'}
            </p>
            <button
              onClick={() => {
                setForm({ title: '', type: type, status: 'watching', current_season: '1', current_episode: '1' })
                setShowAdd(true)
              }}
              className="text-primary-600 text-sm font-medium"
            >
              + Lägg till {tab === 0 ? 'en serie' : 'ett program'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => {
              const myRating = getRating(t.id, user.id)
              const partnerRating = partner ? getRating(t.id, partner.user_id) : 0
              const meta = STATUS_META[t.status] || STATUS_META.watching

              return (
                <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-snug">{t.title}</p>
                      {t.type === 'series' && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Säsong {t.current_season} · Avsnitt {t.current_episode}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>
                        {meta.label}
                      </span>
                      <button
                        onClick={() => deleteTitle(t.id)}
                        className="text-gray-200 hover:text-red-400 transition text-xl leading-none"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Episode controls (series only) */}
                  {t.type === 'series' && (
                    <div className="flex gap-2 mb-3">
                      <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-1.5 flex-1">
                        <span className="text-xs text-gray-400 w-10">Säsong</span>
                        <button
                          onClick={() => updateEpisode(t, 'current_season', t.current_season - 1)}
                          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 text-lg font-light"
                        >
                          −
                        </button>
                        <span className="text-sm font-semibold text-gray-900 w-5 text-center">
                          {t.current_season}
                        </span>
                        <button
                          onClick={() => updateEpisode(t, 'current_season', t.current_season + 1)}
                          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 text-lg font-light"
                        >
                          +
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-1.5 flex-1">
                        <span className="text-xs text-gray-400 w-10">Avsnitt</span>
                        <button
                          onClick={() => updateEpisode(t, 'current_episode', t.current_episode - 1)}
                          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 text-lg font-light"
                        >
                          −
                        </button>
                        <span className="text-sm font-semibold text-gray-900 w-5 text-center">
                          {t.current_episode}
                        </span>
                        <button
                          onClick={() => updateEpisode(t, 'current_episode', t.current_episode + 1)}
                          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 text-lg font-light"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Status selector */}
                  <div className="flex gap-1.5 mb-3">
                    {Object.entries(STATUS_META).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => updateStatus(t, key)}
                        className={`flex-1 text-xs py-1 rounded-lg font-medium transition ${
                          t.status === key
                            ? val.cls + ' ring-1 ring-inset ring-current'
                            : 'bg-gray-50 text-gray-400'
                        }`}
                      >
                        {val.label}
                      </button>
                    ))}
                  </div>

                  {/* Ratings */}
                  <div className="border-t border-gray-50 pt-3 flex gap-4">
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">{profile?.name} (du)</p>
                      <Stars
                        rating={myRating}
                        onRate={r => rateTitle(t.id, r)}
                      />
                    </div>
                    {partner && (
                      <div>
                        <p className="text-[10px] text-gray-400 mb-1">{partner.profiles?.name}</p>
                        <Stars rating={partnerRating} muted />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end z-[60]"
          onClick={() => setShowAdd(false)}
        >
          <div
            className="bg-white w-full max-w-md mx-auto rounded-t-2xl p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                {form.type === 'series' ? 'Ny serie' : 'Nytt program'}
              </h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>

            <form onSubmit={addTitle} className="space-y-3">
              {/* Type toggle */}
              <div className="flex gap-2">
                {['series', 'program'].map(tp => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, type: tp }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                      form.type === tp
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {tp === 'series' ? '📺 Serie' : '🎬 Program'}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Titel"
                required
                autoFocus
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="input"
              />

              {form.type === 'series' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Säsong</p>
                    <input
                      type="number"
                      min="1"
                      value={form.current_season}
                      onChange={e => setForm(p => ({ ...p, current_season: e.target.value }))}
                      className="input"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Avsnitt</p>
                    <input
                      type="number"
                      min="1"
                      value={form.current_episode}
                      onChange={e => setForm(p => ({ ...p, current_episode: e.target.value }))}
                      className="input"
                    />
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-400 mb-1">Status</p>
                <div className="flex gap-2">
                  {Object.entries(STATUS_META).map(([key, val]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, status: key }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition ${
                        form.status === key
                          ? val.cls + ' ring-1 ring-inset ring-current'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn-primary">Lägg till</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
