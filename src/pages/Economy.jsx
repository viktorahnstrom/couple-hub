import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../contexts/HouseholdContext'
import { useAuth } from '../contexts/AuthContext'

const TABS = ['Kategorier', 'Utgifter', 'Mål']

export default function Economy() {
  const { household } = useHousehold()
  const { user } = useAuth()
  const [tab, setTab] = useState(0)
  const [categories, setCategories] = useState([])
  const [expenses, setExpenses] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal visibility
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)

  // Forms
  const [expenseForm, setExpenseForm] = useState({
    description: '', amount: '', category_id: '',
    date: new Date().toISOString().split('T')[0]
  })
  const [categoryForm, setCategoryForm] = useState({ name: '', monthly_limit: '', icon: '📦' })
  const [goalForm, setGoalForm] = useState({
    name: '', target_amount: '', current_amount: '',
    deadline: '', icon: '🎯'
  })

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().split('T')[0]
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString().split('T')[0]

  useEffect(() => {
    if (!household) return
    fetchAll()
  }, [household])

  async function fetchAll() {
    setLoading(true)
    const [catRes, expRes, goalRes] = await Promise.all([
      supabase
        .from('budget_categories')
        .select('*')
        .eq('household_id', household.id)
        .order('name'),
      supabase
        .from('expenses')
        .select('*, profiles(name), budget_categories(name, icon)')
        .eq('household_id', household.id)
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)
        .order('date', { ascending: false }),
      supabase
        .from('savings_goals')
        .select('*')
        .eq('household_id', household.id)
        .order('created_at')
    ])
    setCategories(catRes.data || [])
    setExpenses(expRes.data || [])
    setGoals(goalRes.data || [])
    setLoading(false)
  }

  async function addExpense(e) {
    e.preventDefault()
    await supabase.from('expenses').insert({
      household_id: household.id,
      paid_by: user.id,
      description: expenseForm.description,
      amount: parseFloat(expenseForm.amount),
      category_id: expenseForm.category_id || null,
      date: expenseForm.date
    })
    setExpenseForm({ description: '', amount: '', category_id: '', date: new Date().toISOString().split('T')[0] })
    setShowAddExpense(false)
    fetchAll()
  }

  async function addCategory(e) {
    e.preventDefault()
    await supabase.from('budget_categories').insert({
      household_id: household.id,
      name: categoryForm.name,
      monthly_limit: parseFloat(categoryForm.monthly_limit),
      icon: categoryForm.icon
    })
    setCategoryForm({ name: '', monthly_limit: '', icon: '📦' })
    setShowAddCategory(false)
    fetchAll()
  }

  async function addGoal(e) {
    e.preventDefault()
    await supabase.from('savings_goals').insert({
      household_id: household.id,
      name: goalForm.name,
      target_amount: parseFloat(goalForm.target_amount),
      current_amount: parseFloat(goalForm.current_amount) || 0,
      deadline: goalForm.deadline || null,
      icon: goalForm.icon
    })
    setGoalForm({ name: '', target_amount: '', current_amount: '', deadline: '', icon: '🎯' })
    setShowAddGoal(false)
    fetchAll()
  }

  async function updateGoalAmount(goal) {
    const input = prompt(`Uppdatera sparat belopp för "${goal.name}" (kr):`, goal.current_amount)
    if (input === null) return
    const val = parseFloat(input)
    if (isNaN(val)) return
    await supabase.from('savings_goals').update({ current_amount: val }).eq('id', goal.id)
    fetchAll()
  }

  // Derived stats
  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const totalBudget = categories.reduce((sum, c) => sum + Number(c.monthly_limit), 0)
  const spentByCategory = expenses.reduce((acc, e) => {
    if (e.category_id) acc[e.category_id] = (acc[e.category_id] || 0) + Number(e.amount)
    return acc
  }, {})
  const monthName = format(now, 'MMMM yyyy', { locale: sv })

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 pt-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900 capitalize">{monthName}</h1>
          <button
            onClick={() => setShowAddExpense(true)}
            className="bg-primary-600 text-white rounded-full px-4 py-1.5 text-sm font-medium"
          >
            + Utgift
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">Spenderat</p>
            <p className="text-lg font-semibold text-gray-900">
              {Math.round(totalSpent).toLocaleString('sv-SE')} kr
            </p>
            {totalBudget > 0 && (
              <p className="text-xs text-gray-400">
                av {Math.round(totalBudget).toLocaleString('sv-SE')} kr
              </p>
            )}
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">Kvar</p>
            <p className={`text-lg font-semibold ${
              totalBudget > 0 && totalSpent > totalBudget ? 'text-red-500' : 'text-gray-900'
            }`}>
              {totalBudget > 0
                ? `${Math.round(totalBudget - totalSpent).toLocaleString('sv-SE')} kr`
                : '–'}
            </p>
            {totalBudget > 0 && (
              <p className="text-xs text-gray-400">
                {Math.round(Math.max(0, 100 - (totalSpent / totalBudget) * 100))}% kvar
              </p>
            )}
          </div>
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
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── CATEGORIES ── */}
            {tab === 0 && (
              <div className="space-y-2">
                {categories.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-8">
                    Inga kategorier ännu
                  </p>
                )}
                {categories.map(cat => {
                  const spent = spentByCategory[cat.id] || 0
                  const pct = cat.monthly_limit > 0
                    ? Math.min((spent / cat.monthly_limit) * 100, 100)
                    : 0
                  return (
                    <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{cat.icon}</span>
                          <span className="font-medium text-gray-900 text-sm">{cat.name}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {Math.round(spent).toLocaleString('sv-SE')} /{' '}
                          {Math.round(Number(cat.monthly_limit)).toLocaleString('sv-SE')} kr
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct > 90 ? 'bg-red-400' :
                            pct > 70 ? 'bg-amber-400' :
                            'bg-primary-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                <button
                  onClick={() => setShowAddCategory(true)}
                  className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-4 text-sm text-gray-400 hover:border-primary-300 hover:text-primary-500 transition"
                >
                  + Lägg till kategori
                </button>
              </div>
            )}

            {/* ── EXPENSES ── */}
            {tab === 1 && (
              <div className="space-y-2">
                {expenses.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-4xl mb-3">💸</p>
                    <p className="text-gray-400 text-sm">Inga utgifter denna månad</p>
                    <button
                      onClick={() => setShowAddExpense(true)}
                      className="text-primary-600 text-sm font-medium mt-2"
                    >
                      + Lägg till
                    </button>
                  </div>
                ) : expenses.map(exp => (
                  <div
                    key={exp.id}
                    className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center gap-3"
                  >
                    <span className="text-xl flex-shrink-0">
                      {exp.budget_categories?.icon || '💳'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {exp.description}
                      </p>
                      <p className="text-xs text-gray-400">
                        {exp.profiles?.name} ·{' '}
                        {format(new Date(exp.date), 'd MMM', { locale: sv })}
                        {exp.budget_categories?.name && ` · ${exp.budget_categories.name}`}
                      </p>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm flex-shrink-0">
                      {Number(exp.amount).toLocaleString('sv-SE')} kr
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* ── SAVINGS GOALS ── */}
            {tab === 2 && (
              <div className="space-y-3">
                {goals.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-8">
                    Inga sparmål ännu
                  </p>
                )}
                {goals.map(goal => {
                  const pct = goal.target_amount > 0
                    ? Math.min((goal.current_amount / goal.target_amount) * 100, 100)
                    : 0
                  return (
                    <div key={goal.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{goal.icon}</span>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{goal.name}</p>
                            {goal.deadline && (
                              <p className="text-xs text-gray-400">
                                Mål: {format(new Date(goal.deadline), 'MMM yyyy', { locale: sv })}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs bg-primary-50 text-primary-600 font-medium px-2 py-1 rounded-full">
                          {Math.round(pct)}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-primary-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-400">
                          {Math.round(Number(goal.current_amount)).toLocaleString('sv-SE')} /{' '}
                          {Math.round(Number(goal.target_amount)).toLocaleString('sv-SE')} kr
                        </p>
                        <button
                          onClick={() => updateGoalAmount(goal)}
                          className="text-xs text-primary-600 font-medium"
                        >
                          Uppdatera →
                        </button>
                      </div>
                    </div>
                  )
                })}
                <button
                  onClick={() => setShowAddGoal(true)}
                  className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-4 text-sm text-gray-400 hover:border-primary-300 hover:text-primary-500 transition"
                >
                  + Nytt sparmål
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MODALS ── */}

      <Modal show={showAddExpense} onClose={() => setShowAddExpense(false)} title="Ny utgift">
        <form onSubmit={addExpense} className="space-y-3">
          <input
            type="text"
            placeholder="Beskrivning"
            required
            value={expenseForm.description}
            onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))}
            className="input"
          />
          <input
            type="number"
            placeholder="Belopp (kr)"
            required
            step="0.01"
            min="0"
            value={expenseForm.amount}
            onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
            className="input"
          />
          <select
            value={expenseForm.category_id}
            onChange={e => setExpenseForm(p => ({ ...p, category_id: e.target.value }))}
            className="input bg-white"
          >
            <option value="">Ingen kategori</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
          <input
            type="date"
            required
            value={expenseForm.date}
            onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))}
            className="input"
          />
          <button type="submit" className="btn-primary">Spara utgift</button>
        </form>
      </Modal>

      <Modal show={showAddCategory} onClose={() => setShowAddCategory(false)} title="Ny budgetkategori">
        <form onSubmit={addCategory} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="📦"
              value={categoryForm.icon}
              onChange={e => setCategoryForm(p => ({ ...p, icon: e.target.value }))}
              className="w-16 border border-gray-200 rounded-xl px-3 py-3 text-center text-lg outline-none"
            />
            <input
              type="text"
              placeholder="Kategorinamn"
              required
              value={categoryForm.name}
              onChange={e => setCategoryForm(p => ({ ...p, name: e.target.value }))}
              className="input flex-1"
            />
          </div>
          <input
            type="number"
            placeholder="Månadsbudget (kr)"
            required
            step="100"
            min="0"
            value={categoryForm.monthly_limit}
            onChange={e => setCategoryForm(p => ({ ...p, monthly_limit: e.target.value }))}
            className="input"
          />
          <button type="submit" className="btn-primary">Skapa kategori</button>
        </form>
      </Modal>

      <Modal show={showAddGoal} onClose={() => setShowAddGoal(false)} title="Nytt sparmål">
        <form onSubmit={addGoal} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="🎯"
              value={goalForm.icon}
              onChange={e => setGoalForm(p => ({ ...p, icon: e.target.value }))}
              className="w-16 border border-gray-200 rounded-xl px-3 py-3 text-center text-lg outline-none"
            />
            <input
              type="text"
              placeholder="Namn på målet"
              required
              value={goalForm.name}
              onChange={e => setGoalForm(p => ({ ...p, name: e.target.value }))}
              className="input flex-1"
            />
          </div>
          <input
            type="number"
            placeholder="Målbelopp (kr)"
            required
            min="0"
            value={goalForm.target_amount}
            onChange={e => setGoalForm(p => ({ ...p, target_amount: e.target.value }))}
            className="input"
          />
          <input
            type="number"
            placeholder="Redan sparat (kr)"
            min="0"
            value={goalForm.current_amount}
            onChange={e => setGoalForm(p => ({ ...p, current_amount: e.target.value }))}
            className="input"
          />
          <input
            type="date"
            placeholder="Måldatum (valfritt)"
            value={goalForm.deadline}
            onChange={e => setGoalForm(p => ({ ...p, deadline: e.target.value }))}
            className="input"
          />
          <button type="submit" className="btn-primary">Skapa mål</button>
        </form>
      </Modal>
    </div>
  )
}

// ─── Shared components ─────────────────────

function Modal({ show, onClose, title, children }) {
  if (!show) return null
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-50" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md mx-auto rounded-t-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
