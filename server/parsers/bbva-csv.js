const { parse } = require('csv-parse/sync')

// BBVA CSV: semicolon-separated
// Fecha;Concepto;Cargo;Abono;Saldo
function parseBBVACSV(buffer) {
  const text = buffer.toString('utf-8').replace(/^\uFEFF/, '') // strip BOM

  let rows
  try {
    rows = parse(text, {
      delimiter: ';',
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    })
  } catch {
    // Try comma delimiter fallback
    rows = parse(text, {
      delimiter: ',',
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    })
  }

  if (!rows.length) {
    throw new Error('El archivo CSV está vacío o no tiene el formato correcto de BBVA México. Descarga el CSV desde BBVA en Línea → Movimientos → Exportar.')
  }

  // Normalize column names
  const colMap = {}
  const firstRow = rows[0]
  for (const key of Object.keys(firstRow)) {
    const k = key.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (k.includes('fecha')) colMap.date = key
    else if (k.includes('concepto') || k.includes('descripcion')) colMap.desc = key
    else if (k.includes('cargo')) colMap.cargo = key
    else if (k.includes('abono')) colMap.abono = key
  }

  if (!colMap.date || !colMap.desc) {
    throw new Error('Formato CSV no reconocido. Se esperan columnas: Fecha, Concepto, Cargo, Abono. Usa el exportador de BBVA en Línea.')
  }

  const transactions = []
  for (const row of rows) {
    const dateRaw = row[colMap.date]?.trim()
    const desc = row[colMap.desc]?.trim()
    const cargoRaw = row[colMap.cargo]?.trim() || '0'
    const abonoRaw = colMap.abono ? row[colMap.abono]?.trim() : '0'

    if (!dateRaw || !desc) continue

    const date = parseDate(dateRaw)
    if (!date) continue

    const cargo = parseMXNAmount(cargoRaw)
    const abono = parseMXNAmount(abonoRaw || '0')

    // Positive cargo = expense, skip abonos (payments/deposits)
    if (cargo > 0) {
      transactions.push({ date, description: desc.toUpperCase(), amount: cargo })
    } else if (abono > 0) {
      // Record payments as negative (income)
      transactions.push({ date, description: desc.toUpperCase(), amount: -abono })
    }
  }

  if (!transactions.length) {
    throw new Error('No se encontraron movimientos válidos en el CSV. Verifica que el archivo contenga cargos o abonos.')
  }

  return transactions
}

function parseDate(raw) {
  if (!raw) return null
  // DD/MM/YYYY
  let m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  // YYYY-MM-DD
  m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return raw
  // DD-MM-YYYY
  m = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

function parseMXNAmount(raw) {
  if (!raw) return 0
  // Remove currency symbols, spaces, thousands separators
  const clean = raw.replace(/[$MXN\s]/g, '').replace(/,(?=\d{3})/g, '').replace(',', '.')
  const n = parseFloat(clean)
  return isNaN(n) ? 0 : Math.abs(n)
}

module.exports = { parseBBVACSV }
