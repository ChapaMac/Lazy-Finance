export function formatMXN(amount) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(Math.abs(amount))
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export function formatMonth(monthStr) {
  if (!monthStr) return ''
  const [year, month] = monthStr.split('-')
  const date = new Date(year, parseInt(month) - 1, 1)
  return date.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })
}

export function formatMonthLong(monthStr) {
  if (!monthStr) return ''
  const [year, month] = monthStr.split('-')
  const date = new Date(year, parseInt(month) - 1, 1)
  return date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}

export const CATEGORIES = [
  'Comida',
  'Transporte',
  'Supermercado',
  'Salud',
  'Entretenimiento',
  'Servicios',
  'Hogar',
  'Ropa',
  'Viajes',
  'Educacion',
  'Alcohol',
  'Ingresos',
  'Transferencias',
  'Pago TC',
  'Otros',
]

export const CATEGORY_COLORS = {
  Comida: '#F59E0B',
  Transporte: '#3B82F6',
  Supermercado: '#10B981',
  Salud: '#EF4444',
  Entretenimiento: '#8B5CF6',
  Servicios: '#06B6D4',
  Hogar: '#84CC16',
  Ropa: '#EC4899',
  Viajes: '#F97316',
  Educacion: '#6366F1',
  Alcohol: '#A855F7',
  Ingresos: '#34D399',
  'Transferencias': '#818CF8',
  'Pago TC': '#64748B',
  Otros: '#6B7280',
}
