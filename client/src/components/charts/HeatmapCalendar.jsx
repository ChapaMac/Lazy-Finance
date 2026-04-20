import { formatMXN } from '../../utils/formatters'
import { useI18n } from '../../contexts/I18nContext'

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getIntensity(value, max) {
  if (!value || !max) return 0
  return value / max
}

function intensityToColor(intensity) {
  if (intensity === 0) return '#0F1E3C'
  if (intensity < 0.25) return '#064e3b'
  if (intensity < 0.5) return '#065f46'
  if (intensity < 0.75) return '#047857'
  return '#10B981'
}

export default function HeatmapCalendar({ data, year, month }) {
  const { t, lang } = useI18n()
  const DAYS = lang === 'es' ? DAYS_ES : DAYS_EN

  if (!year || !month) return null

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDow = new Date(year, month - 1, 1).getDay()
  const maxSpend = Math.max(...(data?.map(d => d.total) || [0]), 1)

  const dayMap = {}
  data?.forEach(d => {
    const day = parseInt(d.date.split('-')[2])
    dayMap[day] = d.total
  })

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-slate-500 text-xs py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />
          const total = dayMap[day] || 0
          const intensity = getIntensity(total, maxSpend)
          const color = intensityToColor(intensity)
          return (
            <div
              key={day}
              title={total ? `${day}: ${formatMXN(total)}` : `${day}: $0`}
              className="aspect-square rounded-sm flex items-center justify-center text-xs cursor-default transition-opacity hover:opacity-80"
              style={{ backgroundColor: color }}
            >
              <span className={`text-[10px] ${total > 0 ? 'text-white font-medium' : 'text-slate-600'}`}>{day}</span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-2 mt-3 justify-end">
        <span className="text-slate-500 text-xs">{lang === 'es' ? 'Menos' : 'Less'}</span>
        {[0, 0.2, 0.5, 0.8, 1].map((v, i) => (
          <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: intensityToColor(v) }} />
        ))}
        <span className="text-slate-500 text-xs">{lang === 'es' ? 'Más' : 'More'}</span>
      </div>
    </div>
  )
}
