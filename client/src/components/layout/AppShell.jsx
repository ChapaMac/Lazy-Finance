import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppShell() {
  return (
    <div className="min-h-screen text-gray-200 flex" style={{ background: '#0B0F14' }}>
      <Sidebar />
      <main className="flex-1 ml-52 min-h-screen">
        <div className="max-w-5xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
