import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Auth() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (mode === 'login') {
      const { error } = await signIn(form.email, form.password)
      if (error) setError(error.message)
    } else {
      if (!form.name.trim()) {
        setError('Ange ditt namn')
        setLoading(false)
        return
      }
      const { error } = await signUp(form.email, form.password, form.name)
      if (error) setError(error.message)
      else setSuccessMsg('Kolla din e-post och bekräfta ditt konto!')
    }
    setLoading(false)
  }

  function switchMode(m) {
    setMode(m)
    setError('')
    setSuccessMsg('')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🏠</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Couples Hub</h1>
        <p className="text-gray-400 text-sm mt-1">Ert gemensamma liv, organiserat</p>
      </div>

      <div className="w-full max-w-sm">
        {/* Tab toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => switchMode('login')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'login'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500'
            }`}
          >
            Logga in
          </button>
          <button
            onClick={() => switchMode('signup')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'signup'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500'
            }`}
          >
            Skapa konto
          </button>
        </div>

        {successMsg ? (
          <div className="bg-green-50 text-green-700 rounded-2xl p-5 text-sm text-center leading-relaxed">
            <p className="text-2xl mb-2">📬</p>
            {successMsg}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Namn</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Ditt förnamn"
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">E-post</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="din@email.com"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Lösenord</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Minst 6 tecken"
                required
                minLength={6}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl py-2 px-4">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-60"
            >
              {loading
                ? 'Laddar...'
                : mode === 'login' ? 'Logga in' : 'Skapa konto'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
