import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2, Bot, User, Sparkles } from 'lucide-react'
import api from '../../utils/api'

// ── Quick prompts ─────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  '¿En qué gasté más este mes?',
  '¿Cómo estoy vs el mes pasado?',
  '¿Cuánto puedo ahorrar?',
  '¿Cuáles son mis gastos fijos?',
]

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
        style={{
          background: isUser ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.15)',
          border: isUser ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(99,102,241,0.25)',
        }}>
        {isUser
          ? <User size={11} className="text-emerald-400" />
          : <Bot size={11} className="text-indigo-400" />
        }
      </div>
      <div
        className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
        style={{
          background: isUser ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
          border: isUser ? '1px solid rgba(34,197,94,0.15)' : '1px solid rgba(255,255,255,0.06)',
          color: isUser ? '#d1fae5' : '#cbd5e1',
          borderRadius: isUser ? '18px 6px 18px 18px' : '6px 18px 18px 18px',
        }}>
        {msg.content}
      </div>
    </div>
  )
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex gap-2 flex-row">
      <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
        style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}>
        <Bot size={11} className="text-indigo-400" />
      </div>
      <div className="rounded-2xl px-3.5 py-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex gap-1 items-center">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500"
              style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ChatPanel({ year, month }) {
  const [open, setOpen]         = useState(false)
  const [input, setInput]       = useState('')
  const [messages, setMessages] = useState([])
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)
  const abortRef  = useRef(null)

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: '¡Hola! Soy tu asistente financiero. Tengo acceso a tus datos reales de este mes. ¿En qué te puedo ayudar?',
      }])
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  async function send(text) {
    const msg = (text || input).trim()
    if (!msg || streaming) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setStreaming(true)
    setStreamText('')

    const history = messages.slice(-8)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ message: msg, history, year, month }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `Error ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            if (parsed.text) {
              full += parsed.text
              setStreamText(full)
            }
          } catch {}
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: full }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message}. Intenta de nuevo.`,
      }])
    } finally {
      setStreaming(false)
      setStreamText('')
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // ── FAB button (always visible) ───────────────────────────────────────────
  return (
    <>
      {/* Floating action button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-13 h-13 rounded-2xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 shadow-2xl"
        style={{
          width: 52, height: 52,
          background: open ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
          border: open ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(34,197,94,0.3)',
          boxShadow: open ? '0 4px 20px rgba(239,68,68,0.2)' : '0 4px 20px rgba(34,197,94,0.3)',
        }}>
        {open
          ? <X size={20} className="text-red-400" />
          : <MessageCircle size={20} className="text-black" />
        }
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-20 right-6 z-50 flex flex-col rounded-2xl overflow-hidden shadow-2xl"
          style={{
            width: 360,
            height: 520,
            background: '#0B0F14',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          }}>

          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3.5 flex-shrink-0"
            style={{ background: '#0F172A', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)' }}>
              <Sparkles size={13} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-200">Asistente financiero</p>
              <p className="text-xs text-slate-600">Powered by Claude · datos reales</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin">
            {messages.map((m, i) => <Bubble key={i} msg={m} />)}
            {streaming && streamText && (
              <Bubble msg={{ role: 'assistant', content: streamText + '▋' }} />
            )}
            {streaming && !streamText && <TypingDots />}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts (only when no user messages yet) */}
          {messages.length <= 1 && !streaming && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map(q => (
                <button key={q} onClick={() => send(q)}
                  className="text-xs px-2.5 py-1 rounded-full text-slate-400 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 pb-4 pt-2 flex-shrink-0"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-end gap-2 rounded-xl px-3 py-2"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Pregunta algo..."
                rows={1}
                disabled={streaming}
                className="flex-1 bg-transparent text-sm text-gray-200 placeholder-slate-600 resize-none outline-none leading-relaxed"
                style={{ maxHeight: 80 }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || streaming}
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                style={{
                  background: input.trim() && !streaming ? '#22C55E' : 'rgba(255,255,255,0.06)',
                }}>
                {streaming
                  ? <Loader2 size={13} className="text-slate-400 animate-spin" />
                  : <Send size={13} className={input.trim() ? 'text-black' : 'text-slate-600'} />
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
