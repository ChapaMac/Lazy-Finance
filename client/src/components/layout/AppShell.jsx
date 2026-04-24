import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import ChatPanel from '../ui/ChatPanel'

export default function AppShell() {
  return (
    <div className="min-h-screen flex" style={{ background: '#0D1117', color: '#E5E7EB' }}>
      <Sidebar />
      <main className="flex-1 ml-52 min-h-screen">
        <div className="px-8 py-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
      <ChatPanel />
    </div>
  )
}
