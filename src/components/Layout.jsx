import BottomNav from './BottomNav'

export default function Layout({ children }) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 max-w-md mx-auto relative">
      <main className="flex-1 overflow-y-auto pb-nav">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
