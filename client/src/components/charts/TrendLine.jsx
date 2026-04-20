import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatMXN, formatMonth } from '../../utils/formatters'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0F172A',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: '8px 14px',
    }}>
      <p style={{ color: '#94A3B8', fontSize: 11, marginBottom: 2 }}>{label}</p>
      <p style={{ color: '#22C55E', fontSize: 14, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
        {formatMXN(payload[0].value)}
      </p>
    </div>
  )
}

export default function TrendLine({ data }) {
  if (!data?.length) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
        Sin datos de tendencia
      </div>
    )
  }

  const chartData = data.map(d => ({ ...d, label: formatMonth(d.month) }))
  const max = Math.max(...chartData.map(d => d.total))
  const min = Math.min(...chartData.map(d => d.total))
  const trending = chartData[chartData.length - 1]?.total > chartData[0]?.total

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={trending ? '#EF4444' : '#22C55E'} stopOpacity={0.25} />
              <stop offset="100%" stopColor={trending ? '#EF4444' : '#22C55E'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#94A3B8', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
            width={40}
            domain={[min * 0.9, max * 1.05]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="total"
            stroke={trending ? '#EF4444' : '#22C55E'}
            strokeWidth={2}
            fill="url(#trendGrad)"
            dot={false}
            activeDot={{ r: 4, fill: trending ? '#EF4444' : '#22C55E', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
