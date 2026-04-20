import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatMXN } from '../../utils/formatters'
import { useI18n } from '../../contexts/I18nContext'

const RADIAN = Math.PI / 180

function renderLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.06) return null
  const r = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={11} fontWeight={500} opacity={0.9}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div style={{
      background: '#0F172A',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: '8px 14px',
      minWidth: 140,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.payload.fill }} />
        <span style={{ color: '#94A3B8', fontSize: 12 }}>{d.name}</span>
      </div>
      <p style={{ color: '#E5E7EB', fontSize: 15, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
        {formatMXN(d.value)}
      </p>
    </div>
  )
}

export default function DonutChart({ data, colors, onSliceClick }) {
  const { t } = useI18n()

  if (!data?.length) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-600 text-sm">
        Sin datos del mes
      </div>
    )
  }

  const chartData = data.map(d => ({
    ...d,
    name:  t(`category.${d.category}`) || d.category,
    fill:  colors[d.category] || '#6B7280',
  }))

  const total = chartData.reduce((s, d) => s + d.total, 0)
  const dominant = chartData[0]

  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={62}
            outerRadius={96}
            dataKey="total"
            labelLine={false}
            label={renderLabel}
            cursor={onSliceClick ? 'pointer' : undefined}
            onClick={onSliceClick ? (entry) => onSliceClick(entry.category) : undefined}
            strokeWidth={0}
          >
            {chartData.map((entry) => (
              <Cell key={entry.category} fill={entry.fill} opacity={0.9} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend list — ordered by amount */}
      <div className="space-y-2">
        {chartData.slice(0, 6).map(d => (
          <div key={d.category}
            className={`flex items-center gap-3 ${onSliceClick ? 'cursor-pointer group' : ''}`}
            onClick={onSliceClick ? () => onSliceClick(d.category) : undefined}>
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.fill }} />
            <span className={`text-xs flex-1 truncate transition-colors ${onSliceClick ? 'text-slate-400 group-hover:text-gray-200' : 'text-slate-400'}`}>
              {d.name}
            </span>
            <span className="text-xs font-mono text-slate-500">{((d.total / total) * 100).toFixed(0)}%</span>
            <span className="text-xs font-mono text-gray-300 w-24 text-right">{formatMXN(d.total)}</span>
          </div>
        ))}
        {chartData.length > 6 && (
          <p className="text-xs text-slate-600 pl-5">+{chartData.length - 6} categorías más</p>
        )}
      </div>
    </div>
  )
}
