import { createContext, useContext, useState, useCallback } from 'react'
import { Check, X } from 'lucide-react'

const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((msg, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(({ id, msg, type }) => (
          <div
            key={id}
            style={{
              animation: 'toastIn 0.2s ease-out forwards',
              background: type === 'success' ? 'rgba(5,46,22,0.97)' : 'rgba(45,10,10,0.97)',
              border: `1px solid ${type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium ${
              type === 'success' ? 'text-emerald-300' : 'text-red-300'
            }`}
          >
            {type === 'success'
              ? <Check size={14} className="flex-shrink-0 text-emerald-400" />
              : <X size={14} className="flex-shrink-0 text-red-400" />
            }
            {msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
