import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatMXN, formatMonth } from '../../utils/formatters'
import { useI18n } from '../../contexts/I18nContext'

export default function BarComparison({ data, months }) {
  const { t } = useI18n()

  if (!data?.length) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
        {t('insights.noData')}
      </div>
    )
  }

  const categories = [...new Set(data.map(d => d.category))]
  const monthsUniq = months || [...new Set(data.map(d => d.month))].slice(-2)

  const chartData = categories.map(cat => {
    const row = { category: t(`category.${cat}`) || cat }
    monthsUniq.forEach(m => {
      const found = data.find(d => d.category === cat && d.month === m)
      row[m] = found ? found.total : 0
    })
    return row
  }).sort((a, b) => {
    const sumA = monthsUniq.reduce((s, m) => s + (a[m] || 0), 0)
    const sumB = monthsUniq.reduce((s, m) => s + (b[m] || 0), 0)
    return sumB - sumA
  })

  const COLORS = ['#10B981', '#3B82F6']

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
        <XAxis dataKey="category" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: '#94A3B8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
          width={45}
        />
        <Tooltip
          formatter={(value) => [formatMXN(value), '']}
          contentStyle={{ background: '#0F1E3C', border: '1px solid #1E3A5F', borderRadius: 8, color: '#fff' }}
        />
        <Legend formatter={(value) => <span style={{ color: '#94A3B8', fontSize: 12 }}>{formatMonth(value)}</span>} />
        {monthsUniq.map((m, i) => (
          <Bar key={m} dataKey={m} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} maxBarSize={32} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
