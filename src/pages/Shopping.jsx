import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../contexts/HouseholdContext'
import { useAuth } from '../contexts/AuthContext'

export default function Shopping() {
  const { household } = useHousehold()
  const { user } = useAuth()
  const [lists, setLists] = useState([])
  const [activeListId, setActiveListId] = useState(null)
  const [items, setItems] = useState([])
  const [newItem, setNewItem] = useState('')
  const [newQty, setNewQty] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNewList, setShowNewList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const inputRef = useRef(null)

  // Fetch lists on mount
  useEffect(() => {
    if (!household) return
    fetchLists()
  }, [household])

  // Fetch items + subscribe to real-time when active list changes
  useEffect(() => {
    if (!activeListId) return
    fetchItems(activeListId)

    const channel = supabase
      .channel(`shopping-${activeListId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
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

  async function addItem(e) {
    e.preventDefault()
    if (!newItem.trim() || !activeListId) return
    await supabase.from('shopping_items').insert({
      list_id: activeListId,
      name: newItem.trim(),
      quantity: newQty.trim() || null,
      added_by: user.id
    })
    setNewItem('')
    setNewQty('')
    inputRef.current?.focus()
  }

  async function toggleItem(item) {
    await supabase
      .from('shopping_items')
      .update({
        checked: !item.checked,
        checked_by: !item.checked ? user.id : null
      })
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
      .insert({
        household_id: household.id,
        name: newListName.trim(),
        created_by: user.id
      })
      .select()
      .single()
    if (data) {
      setLists(prev => [...prev, data])
      setActiveListId(data.id)
      setNewListName('')
      setShowNewList(false)
    }
  }

  const unchecked = items.filter(i => !i.checked)
  const checked   = items.filter(i => i.checked)

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 pt-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Inköp</h1>
          <button
            onClick={() => setShowNewList(true)}
            className="text-sm text-primary-600 font-medium"
          >
            + Ny lista
          </button>
        </div>

        {/* List tabs */}
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {lists.map(list => (
            <button
              key={list.id}
              onClick={() => setActiveListId(list.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${
                activeListId === list.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {list.name}
            </button>
          ))}
          {lists.length === 0 && (
            <button
              onClick={() => setShowNewList(true)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium bg-primary-100 text-primary-600"
            >
              + Skapa din första lista
            </button>
          )}
        </div>
      </div>

      {/* Add item form */}
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

      {/* Items list */}
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
            {/* Unchecked */}
            {unchecked.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-3">
                {unchecked.map((item, i) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onToggle={() => toggleItem(item)}
                    onDelete={() => deleteItem(item.id)}
                    divider={i < unchecked.length - 1}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {unchecked.length === 0 && checked.length === 0 && (
              <div className="text-center py-14">
                <p className="text-5xl mb-3">🛒</p>
                <p className="text-gray-400 text-sm">Listan är tom</p>
                <p className="text-gray-300 text-xs mt-1">Lägg till varor ovan</p>
              </div>
            )}

            {/* Checked / in cart */}
            {checked.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-400">
                    I korgen ({checked.length})
                  </p>
                  <button onClick={clearChecked} className="text-xs text-red-400 font-medium">
                    Rensa
                  </button>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden opacity-60">
                  {checked.map((item, i) => (
                    <ItemRow
                      key={item.id}
                      item={item}
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

      {/* New list bottom sheet */}
      {showNewList && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end z-50"
          onClick={() => setShowNewList(false)}
        >
          <div
            className="bg-white w-full max-w-md mx-auto rounded-t-2xl p-6"
            onClick={e => e.stopPropagation()}
          >
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
              <button
                type="submit"
                className="w-full bg-primary-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-primary-700 transition"
              >
                Skapa lista
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Item row with swipe-to-delete ────────

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
      <div
        className={`flex items-center gap-3 px-4 py-3.5 bg-white transition-transform duration-200 ${
          swiped ? '-translate-x-16' : 'translate-x-0'
        }`}
      >
        <button
          onClick={onToggle}
          className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-colors ${
            item.checked
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 hover:border-primary-400'
          }`}
        >
          {item.checked && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        <span className={`flex-1 text-sm ${
          item.checked ? 'line-through text-gray-300' : 'text-gray-900'
        }`}>
          {item.name}
        </span>

        {item.quantity && (
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full flex-shrink-0">
            {item.quantity}
          </span>
        )}
      </div>

      {/* Reveal delete button on swipe */}
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
