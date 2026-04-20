const XLSX = require('xlsx')

// AmEx México XLSX: header row detection by keywords, then parse data
function parseAmExXLSX(buffer) {
  let workbook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  } catch {
    throw new Error('No se pudo leer el archivo Excel. Asegúrate de que sea un XLS/XLSX válido.')
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error('El archivo Excel no contiene hojas de datos.')

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false })

  // Find header row by looking for date/amount keywords
  let headerIdx = -1
  let colMap = {}

  const dateKw = ['fecha', 'date']
  const descKw = ['descripcion', 'descripción', 'concepto', 'establecimiento', 'description', 'comercio']
  const amountKw = ['monto', 'importe', 'amount', 'cargo', 'total']

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i].map(c => String(c).toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    const dateCol = row.findIndex(c => dateKw.some(k => c.includes(k)))
    const descCol = row.findIndex(c => descKw.some(k => c.includes(k)))
    const amountCol = row.findIndex(c => amountKw.some(k => c.includes(k)))
    if (dateCol >= 0 && (descCol >= 0 || amountCol >= 0)) {
      headerIdx = i
      colMap = { date: dateCol, desc: descCol >= 0 ? descCol : amountCol, amount: amountCol >= 0 ? amountCol : -1 }
      break
    }
  }

  if (headerIdx < 0) {
    throw new Error(
      'No se encontró la fila de encabezados en el Excel de AmEx. ' +
      'Se esperan columnas: Fecha, Descripción/Establecimiento, Monto/Importe. ' +
      'Descarga el estado desde americanexpress.com.mx → Estado de Cuenta → Formato Excel.'
    )
  }

  const transactions = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const dateRaw = row[colMap.date]
    const descRaw = colMap.desc >= 0 ? row[colMap.desc] : ''
    const amountRaw = colMap.amount >= 0 ? row[colMap.amount] : null

    const date = parseDate(dateRaw)
    if (!date) continue

    const description = String(descRaw).trim().toUpperCase()
    if (!description || description.length < 2) continue

    const amount = parseAmount(amountRaw)
    if (amount === null || amount === 0) continue

    transactions.push({ date, description, amount })
  }

  if (!transactions.length) {
    throw new Error('No se encontraron movimientos válidos en el Excel. Verifica que el archivo sea el estado de cuenta correcto.')
  }

  return transactions
}

function parseDate(raw) {
  if (!raw) return null
  if (raw instanceof Date) {
    const d = raw
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const s = String(raw).trim()
  // DD/MM/YYYY
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  // YYYY-MM-DD
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return s
  // Excel serial date number
  const n = parseFloat(s)
  if (!isNaN(n) && n > 40000) {
    const d = XLSX.SSF.parse_date_code(n)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  return null
}

function parseAmount(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') return raw
  const s = String(raw).trim().replace(/[$MXN\s]/g, '').replace(/,(?=\d{3})/g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

module.exports = { parseAmExXLSX }
