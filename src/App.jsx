import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { HouseholdProvider, useHousehold } from './contexts/HouseholdContext'
import Auth from './pages/Auth'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Shopping from './pages/Shopping'
import Economy from './pages/Economy'
import Calendar from './pages/Calendar'
import More from './pages/More'
import Layout from './components/Layout'

function AppRoutes() {
  const { user, loading: authLoading } = useAuth()
  const { household, loading: hhLoading } = useHousehold()

  if (authLoading || hhLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Not logged in → Auth page
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Auth />} />
      </Routes>
    )
  }

  // Logged in but no household → Onboarding
  if (!household) {
    return (
      <Routes>
        <Route path="*" element={<Onboarding />} />
      </Routes>
    )
  }

  // Fully set up → Main app
  return (
    <Layout>
      <Routes>
        <Route path="/"         element={<Dashboard />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/shopping" element={<Shopping />} />
        <Route path="/economy"  element={<Economy />} />
        <Route path="/more"     element={<More />} />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <HouseholdProvider>
          <AppRoutes />
        </HouseholdProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
