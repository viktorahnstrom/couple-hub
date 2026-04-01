import { useState } from 'react'
import { useHousehold } from '../contexts/HouseholdContext'
import { useAuth } from '../contexts/AuthContext'

export default function Onboarding() {
  const { createHousehold, joinHousehold } = useHousehold()
  const { signOut, profile } = useAuth()
  const [mode, setMode] = useState(null) // null | 'create' | 'join'
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)

  async function handleCreate(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error } = await createHousehold(householdName)
    if (error) setError(error.message)
    else setCreated(data)
    setLoading(false)
  }

  async function handleJoin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await joinHousehold(inviteCode)
    if (error) setError(error.message)
    setLoading(false)
  }

  // After creating: show invite code screen
  if (created) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎉</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Hemmet är skapat!</h2>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            Dela den här koden med din partner så att de kan gå med i ert hem.
          </p>

          <div className="bg-primary-50 rounded-2xl p-6 mb-8">
            <p className="text-xs font-semibold text-primary-500 uppercase tracking-widest mb-3">
              Inbjudningskod
            </p>
            <p className="text-4xl font-bold text-primary-700 tracking-widest font-mono">
              {created.invite_code}
            </p>
            <p className="text-xs text-primary-400 mt-3">
              De anger koden när de skapar sitt konto
            </p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full bg-primary-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-primary-700 transition"
          >
            Fortsätt till appen →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🏠</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            Välkommen, {profile?.name || 'du'}!
          </h2>
          <p className="text-gray-400 text-sm mt-1">Kom igång med ert gemensamma hem</p>
        </div>

        {/* Mode selection */}
        {!mode && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full border border-gray-200 rounded-2xl p-4 text-left hover:border-primary-300 hover:bg-primary-50 transition"
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl">✨</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Skapa ett nytt hem</p>
                  <p className="text-gray-400 text-xs mt-0.5">Du skapar och bjuder sedan in din partner</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full border border-gray-200 rounded-2xl p-4 text-left hover:border-primary-300 hover:bg-primary-50 transition"
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl">🔗</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Gå med i ett hem</p>
                  <p className="text-gray-400 text-xs mt-0.5">Ange inbjudningskoden från din partner</p>
                </div>
              </div>
            </button>

            <button
              onClick={signOut}
              className="w-full text-gray-300 text-xs py-3 hover:text-gray-400 transition"
            >
              Logga ut
            </button>
          </div>
        )}

        {/* Create form */}
        {mode === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <button
              type="button"
              onClick={() => { setMode(null); setError('') }}
              className="text-sm text-gray-400 flex items-center gap-1 mb-2"
            >
              ← Tillbaka
            </button>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Hemnamn</label>
              <input
                type="text"
                value={householdName}
                onChange={e => setHouseholdName(e.target.value)}
                placeholder="t.ex. Alex & Sara"
                required
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500 transition"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-primary-700 transition disabled:opacity-60"
            >
              {loading ? 'Skapar...' : 'Skapa hem'}
            </button>
          </form>
        )}

        {/* Join form */}
        {mode === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <button
              type="button"
              onClick={() => { setMode(null); setError('') }}
              className="text-sm text-gray-400 flex items-center gap-1 mb-2"
            >
              ← Tillbaka
            </button>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Inbjudningskod</label>
              <input
                type="text"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                placeholder="XXXXXXXX"
                required
                maxLength={8}
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-center uppercase tracking-widest font-mono outline-none focus:ring-2 focus:ring-primary-500 transition"
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-primary-700 transition disabled:opacity-60"
            >
              {loading ? 'Ansluter...' : 'Gå med'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
