import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'

const SECTIONS = [
  {
    title: 'Hem & Mat',
    items: [
      { emoji: '🍳', label: 'Recept & matplanering', soon: true },
      { emoji: '🥡', label: 'Skafferi',              soon: true },
      { emoji: '📋', label: 'Veckans matplan',       soon: true },
    ]
  },
  {
    title: 'Livsstil',
    items: [
      { emoji: '🎬', label: 'Film & serie-lista',  soon: true },
      { emoji: '📸', label: 'Minnen & foton',      soon: true },
      { emoji: '🗺️', label: 'Hinkelist',           soon: true },
      { emoji: '💝', label: 'Dejt-planerare',      soon: true },
    ]
  },
  {
    title: 'Ekonomi & Abonnemang',
    items: [
      { emoji: '🔄', label: 'Prenumerationer', soon: true },
      { emoji: '🛍️', label: 'Önskelistor',    soon: true },
    ]
  },
]

export default function More() {
  const { profile, signOut } = useAuth()
  const { household, members } = useHousehold()

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-5 pt-6 pb-4">
        <h1 className="text-xl font-semibold text-gray-900">Mer</h1>
      </div>

      <div className="px-5 py-4 space-y-4">

        {/* Household card */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs text-gray-400 mb-0.5">Ert hem</p>
            <p className="font-semibold text-gray-900">{household?.name}</p>
          </div>

          {/* Members */}
          {members.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-50 flex gap-3">
              {members.map(m => (
                <div key={m.user_id} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-semibold text-primary-700">
                    {m.profiles?.name?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-700">{m.profiles?.name}</span>
                  {m.role === 'owner' && (
                    <span className="text-xs text-gray-300">· ägare</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Invite code */}
          <div className="px-4 py-3">
            <p className="text-xs text-gray-400 mb-2">Inbjudningskod — dela med din partner</p>
            <div className="bg-primary-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <p className="text-xl font-bold text-primary-700 tracking-widest font-mono">
                {household?.invite_code}
              </p>
              <button
                onClick={() => navigator.clipboard?.writeText(household?.invite_code || '')}
                className="text-xs text-primary-500 font-medium"
              >
                Kopiera
              </button>
            </div>
          </div>
        </div>

        {/* Feature sections */}
        {SECTIONS.map(section => (
          <div key={section.title}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
              {section.title}
            </p>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {section.items.map((item, i) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-3 px-4 py-3.5 ${
                    i < section.items.length - 1 ? 'border-b border-gray-50' : ''
                  }`}
                >
                  <span className="text-xl">{item.emoji}</span>
                  <span className="flex-1 text-sm text-gray-700">{item.label}</span>
                  {item.soon && (
                    <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-medium">
                      Snart
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Profile + sign out */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
            Konto
          </p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50">
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-sm font-semibold text-primary-700">
                {profile?.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{profile?.name}</p>
                <p className="text-xs text-gray-400">Ditt konto</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full text-left px-4 py-3.5 text-sm text-red-500 font-medium hover:bg-red-50 transition"
            >
              Logga ut
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-200 py-2">Couples Hub v0.1</p>
      </div>
    </div>
  )
}
