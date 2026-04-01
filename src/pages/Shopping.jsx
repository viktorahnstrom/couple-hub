import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../contexts/HouseholdContext'
import { useAuth } from '../contexts/AuthContext'

const STAPLE_STATUS = {
  ok:     { label: 'Hemma',       cls: 'bg-green-100 text-green-700',     dot: 'bg-green-400'   },
  low:    { label: 'Nästan slut', cls: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-400'   },
  out:    { label: 'Slut',        cls: 'bg-red-100 text-red-600',          dot: 'bg-red-400'     },
  bought: { label: 'Nyköpt',      cls: 'bg-primary-100 text-primary-700', dot: 'bg-primary-400' },
}
const STATUS_CYCLE = ['ok', 'low', 'out', 'bought']
const STATUS_SORT  = { out: 0, low: 1, ok: 2, bought: 3 }

const STAPLE_CATEGORIES = [
  { key: 'mat',    label: 'Mat & dryck', emoji: '🥦' },
  { key: 'ovrigt', label: 'Övrigt',      emoji: '🧴' },
]

export default function Shopping() {
  const { household } = useHousehold()
  const { user } = useAuth()

  // ── Shopping list state ──
  const [viewMode, setViewMode]         = useState('list')
  const [lists, setLists]               = useState([])
  const [activeListId, setActiveListId] = useState(null)
  const [items, setItems]               = useState([])
  const [newItem, setNewItem]           = useState('')
  const [newQty, setNewQty]             = useState('')
  const [loading, setLoading]           = useState(true)
  const [showNewList, setShowNewList]   = useState(false)
  const [newListName, setNewListName]   = useState('')
  const inputRef = useRef(null)

  // List edit modal
  const [editList, setEditList]         = useState(null)   // {id, name}
  const [editListName, setEditListName] = useState('')

  // ── Home staples state ──
  const [staples, setStaples]               = useState([])
  const [staplesLoading, setStaplesLoading] = useState(false)
  const [showAddStaple, setShowAddStaple]   = useState(false)
  const [newStapleName, setNewStapleName]   = useState('')
  const [newStapleCat, setNewStapleCat]     = useState('mat')

  useEffect(() => {
    if (!household) return
    fetchLists()
    fetchStaples()
  }, [household])

  useEffect(() => {
    if (!activeListId) return
    fetchItems(activeListId)
    const channel = supabase
      .channel(`shopping-${activeListId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'shopping_items',
        filter: `list_id=eq.${activeListId}`
      }, () => fetchItems(activeListId))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [activeListId])

  async function fetchLists() {
    const { data } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at')
    setLists(data || [])
    if (data?.length) setActiveListId(data[0].id)
    else setLoading(false)
  }

  async function fetchItems(listId) {
    setLoading(true)
    const { data } = await supabase
      .from('shopping_items')
      .select('*')
      .eq('list_id', listId)
      .order('created_at')
    setItems(data || [])
    setLoading(false)
  }

  async function fetchStaples() {
    setStaplesLoading(true)
    const { data } = await supabase
      .from('home_staples')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at')
    setStaples(data || [])
    setStaplesLoading(false)
  }

  // ── List actions ──
  async function addItem(e) {
    e.preventDefault()
    if (!newItem.trim() || !activeListId) return
    await supabase.from('shopping_items').insert({
      list_id: activeListId, name: newItem.trim(),
      quantity: newQty.trim() || null, added_by: user.id,
    })
    setNewItem('')
    setNewQty('')
    inputRef.current?.focus()
  }

  async function toggleItem(item) {
    await supabase.from('shopping_items')
      .update({ checked: !item.checked, checked_by: !item.checked ? user.id : null })
      .eq('id', item.id)
  }

  async function deleteItem(id) {
    await supabase.from('shopping_items').delete().eq('id', id)
  }

  async function clearChecked() {
    const ids = items.filter(i => i.checked).map(i => i.id)
    if (!ids.length) return
    await supabase.from('shopping_items').delete().in('id', ids)
  }

  async function createList(e) {
    e.preventDefault()
    if (!newListName.trim()) return
    const { data } = await supabase
      .from('shopping_lists')
      .insert({ household_id: household.id, name: newListName.trim(), created_by: user.id })
      .select().single()
    if (data) {
      setLists(prev => [...prev, data])
      setActiveListId(data.id)
      setNewListName('')
      setShowNewList(false)
      setViewMode('list')
    }
  }

  async function renameList(e) {
    e.preventDefault()
    if (!editListName.trim() || !editList) return
    await supabase.from('shopping_lists').update({ name: editListName.trim() }).eq('id', editList.id)
    setLists(prev => prev.map(l => l.id === editList.id ? { ...l, name: editListName.trim() } : l))
    setEditList(null)
  }

  async function deleteList() {
    if (!editList) return
    await supabase.from('shopping_lists').delete().eq('id', editList.id)
    const remaining = lists.filter(l => l.id !== editList.id)
    setLists(remaining)
    setActiveListId(remaining[0]?.id || null)
    setItems([])
    setEditList(null)
  }

  // ── Staple actions ──
  async function addStaple(e) {
    e.preventDefault()
    if (!newStapleName.trim()) return
    const { data, error } = await supabase.from('home_staples').insert({
      household_id: household.id,
      added_by: user.id,
      name: newStapleName.trim(),
      category: newStapleCat,
      status: 'ok',
    }).select().single()
    if (!error && data) setStaples(prev => [...prev, data])
    setNewStapleName('')
    setShowAddStaple(false)
  }

  async function cycleStatus(staple) {
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(staple.status) + 1) % STATUS_CYCLE.length]
    await supabase.from('home_staples').update({ status: next }).eq('id', staple.id)
    setStaples(prev => prev.map(s => s.id === staple.id ? { ...s, status: next } : s))
  }

  async function deleteStaple(id) {
    await supabase.from('home_staples').delete().eq('id', id)
    setStaples(prev => prev.filter(s => s.id !== id))
  }

  const unchecked = items.filter(i => !i.checked)
  const checked   = items.filter(i => i.checked)

  const sortedStaples = [...staples].sort(
    (a, b) => (STATUS_SORT[a.status] ?? 2) - (STATUS_SORT[b.status] ?? 2)
  )
  const needsTopping = staples.filter(s => s.status === 'out' || s.status === 'low')

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 pt-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900">
            {viewMode === 'hemma' ? 'Hemma' : 'Inköp'}
          </h1>
          {viewMode === 'hemma' ? (
            <button
              onClick={() => setShowAddStaple(true)}
              className="bg-primary-600 text-white rounded-full px-4 py-1.5 text-sm font-medium"
            >
              + Vara
            </button>
          ) : (
            <button
              onClick={() => setShowNewList(true)}
              className="text-sm text-primary-600 font-medium"
            >
              + Ny lista
            </button>
          )}
        </div>

        {/* Tab row */}
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          <button
            onClick={() => setViewMode('hemma')}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition flex items-center gap-1.5 ${
              viewMode === 'hemma' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            🏠 Hemma
            {viewMode !== 'hemma' && needsTopping.length > 0 && (
              <span className="w-4 h-4 bg-red-400 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                {needsTopping.length > 9 ? '9+' : needsTopping.length}
              </span>
            )}
          </button>

          {lists.map(list => (
            <div key={list.id} className="flex-shrink-0 flex items-center">
              <button
                onClick={() => { setViewMode('list'); setActiveListId(list.id) }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                  viewMode === 'list' && activeListId === list.id
                    ? 'bg-primary-600 text-white rounded-r-none pr-2'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {list.name}
              </button>
              {viewMode === 'list' && activeListId === list.id && (
                <button
                  onClick={() => { setEditList(list); setEditListName(list.name) }}
                  className="bg-primary-600 text-white rounded-r-full pl-1 pr-3 py-1.5 text-xs border-l border-primary-500"
                >
                  ···
                </button>
              )}
            </div>
          ))}

          {lists.length === 0 && viewMode === 'list' && (
            <button
              onClick={() => setShowNewList(true)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium bg-primary-100 text-primary-600"
            >
              + Skapa din första lista
            </button>
          )}
        </div>
      </div>

      {/* ── HEMMA VIEW ── */}
      {viewMode === 'hemma' && (
        <div className="px-5 py-4">
          {staplesLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : staples.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🏠</p>
              <p className="text-gray-400 text-sm mb-1">Inga varor tillagda ännu</p>
              <p className="text-gray-300 text-xs mb-4">Lägg till saker ni alltid vill ha hemma</p>
              <button onClick={() => setShowAddStaple(true)} className="text-primary-600 text-sm font-medium">
                + Lägg till första varan
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {needsTopping.length > 0 && (
                <div className="bg-red-50 rounded-2xl px-4 py-3 border border-red-100">
                  <p className="text-xs font-semibold text-red-500 mb-2">
                    Behöver handlas ({needsTopping.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {needsTopping.map(s => (
                      <span key={s.id} className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAPLE_STATUS[s.status].cls}`}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Two category sections */}
              {STAPLE_CATEGORIES.map(cat => {
                const catItems = sortedStaples.filter(s => (s.category || 'mat') === cat.key)
                if (catItems.length === 0) return null
                return (
                  <div key={cat.key}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                      {cat.emoji} {cat.label}
                    </p>
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                      {catItems.map((staple, i) => {
                        const meta = STAPLE_STATUS[staple.status]
                        return (
                          <div
                            key={staple.id}
                            className={`flex items-center gap-3 px-4 py-3.5 ${
                              i < catItems.length - 1 ? 'border-b border-gray-50' : ''
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                            <span className="flex-1 text-sm text-gray-900">{staple.name}</span>
                            <button
                              onClick={() => cycleStatus(staple)}
                              className={`text-xs px-2.5 py-1 rounded-full font-medium transition active:scale-95 ${meta.cls}`}
                            >
                              {meta.label}
                            </button>
                            <button
                              onClick={() => deleteStaple(staple.id)}
                              className="text-gray-200 hover:text-red-400 transition text-xl leading-none ml-1"
                            >
                              ×
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {viewMode === 'list' && (
        <>
          {activeListId && (
            <div className="px-5 py-4">
              <form onSubmit={addItem} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newItem}
                  onChange={e => setNewItem(e.target.value)}
                  placeholder="Lägg till vara..."
                  className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 transition"
                />
                <input
                  type="text"
                  value={newQty}
                  onChange={e => setNewQty(e.target.value)}
                  placeholder="Mängd"
                  className="w-20 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 transition"
                />
                <button
                  type="submit"
                  className="bg-primary-600 text-white rounded-xl w-10 flex items-center justify-center text-xl font-light hover:bg-primary-700 transition"
                >
                  +
                </button>
              </form>
            </div>
          )}

          <div className="px-5 pb-8">
            {loading && activeListId ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !activeListId ? (
              <div className="text-center py-16 text-gray-300">
                <p className="text-4xl mb-3">🛒</p>
                <p className="text-sm">Inga listor ännu</p>
              </div>
            ) : (
              <>
                {unchecked.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-3">
                    {unchecked.map((item, i) => (
                      <ItemRow
                        key={item.id} item={item}
                        onToggle={() => toggleItem(item)}
                        onDelete={() => deleteItem(item.id)}
                        divider={i < unchecked.length - 1}
                      />
                    ))}
                  </div>
                )}

                {unchecked.length === 0 && checked.length === 0 && (
                  <div className="text-center py-14">
                    <p className="text-5xl mb-3">🛒</p>
                    <p className="text-gray-400 text-sm">Listan är tom</p>
                    <p className="text-gray-300 text-xs mt-1">Lägg till varor ovan</p>
                  </div>
                )}

                {checked.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-gray-400">I korgen ({checked.length})</p>
                      <button onClick={clearChecked} className="text-xs text-red-400 font-medium">Rensa</button>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden opacity-60">
                      {checked.map((item, i) => (
                        <ItemRow
                          key={item.id} item={item}
                          onToggle={() => toggleItem(item)}
                          onDelete={() => deleteItem(item.id)}
                          divider={i < checked.length - 1}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* New list modal */}
      {showNewList && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-[60]" onClick={() => setShowNewList(false)}>
          <div className="bg-white w-full max-w-md mx-auto rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-4">Ny inköpslista</h3>
            <form onSubmit={createList}>
              <input
                type="text"
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                placeholder="t.ex. Veckohandling, IKEA, Apotek..."
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500 mb-4"
              />
              <button type="submit" className="btn-primary">Skapa lista</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit list modal (rename + delete) */}
      {editList && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-[60]" onClick={() => setEditList(null)}>
          <div className="bg-white w-full max-w-md mx-auto rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Redigera lista</h3>
              <button onClick={() => setEditList(null)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <form onSubmit={renameList} className="space-y-3 mb-4">
              <input
                type="text"
                value={editListName}
                onChange={e => setEditListName(e.target.value)}
                autoFocus
                className="input"
              />
              <button type="submit" className="btn-primary">Spara namn</button>
            </form>
            <button
              onClick={deleteList}
              className="w-full py-3 rounded-xl text-sm font-medium text-red-500 bg-red-50 hover:bg-red-100 transition"
            >
              Ta bort lista
            </button>
          </div>
        </div>
      )}

      {/* Add staple modal */}
      {showAddStaple && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-[60]" onClick={() => setShowAddStaple(false)}>
          <div className="bg-white w-full max-w-md mx-auto rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Lägg till hemvara</h3>
              <button onClick={() => setShowAddStaple(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <form onSubmit={addStaple} className="space-y-3">
              <input
                type="text"
                placeholder="t.ex. Mjölk, Smör, Diskmedel..."
                required
                autoFocus
                value={newStapleName}
                onChange={e => setNewStapleName(e.target.value)}
                className="input"
              />
              <div className="flex gap-2">
                {STAPLE_CATEGORIES.map(cat => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setNewStapleCat(cat.key)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                      newStapleCat === cat.key
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
              <button type="submit" className="btn-primary">Lägg till</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Item row ─────────────────────────────

function ItemRow({ item, onToggle, onDelete, divider }) {
  const [swiped, setSwiped] = useState(false)
  const touchStartX = useRef(null)

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    setSwiped(false)
  }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (diff > 60) setSwiped(true)
    else if (diff < -20) setSwiped(false)
    touchStartX.current = null
  }

  return (
    <div
      className={`relative overflow-hidden ${divider ? 'border-b border-gray-50' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className={`flex items-center gap-3 px-4 py-3.5 bg-white transition-transform duration-200 ${
        swiped ? '-translate-x-16' : 'translate-x-0'
      }`}>
        <button
          onClick={onToggle}
          className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-colors ${
            item.checked ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-primary-400'
          }`}
        >
          {item.checked && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
        <span className={`flex-1 text-sm ${item.checked ? 'line-through text-gray-300' : 'text-gray-900'}`}>
          {item.name}
        </span>
        {item.quantity && (
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full flex-shrink-0">
            {item.quantity}
          </span>
        )}
      </div>
      <button
        onClick={onDelete}
        className={`absolute right-0 top-0 bottom-0 w-16 bg-red-500 flex items-center justify-center text-white text-xs font-medium transition-opacity ${
          swiped ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        Ta bort
      </button>
    </div>
  )
}
