const pdfParse = require('pdf-parse')

// Nu México PDF format (observed):
//
// Header:
//   "Periodo:    28 NOV 2025 - 28 DIC 2025 (31 días)"
//
// Each transaction = 3 consecutive lines:
//   Line A: "DD MMM"                          e.g. "28 NOV"
//   Line B: category label                    e.g. "Restaurante"
//   Line C: description + amount glued        e.g. "D Local*Rest Didifood$137.08"
//            credits use "Description- $1,115.99" (minus + space before $)
//
// Sentinel: "Saldo final del periodo$X,XXX.XX" ends the transaction block

const MONTH_MAP = {
  ENE: { n: '01', i: 1 }, FEB: { n: '02', i: 2 }, MAR: { n: '03', i: 3 },
  ABR: { n: '04', i: 4 }, MAY: { n: '05', i: 5 }, JUN: { n: '06', i: 6 },
  JUL: { n: '07', i: 7 }, AGO: { n: '08', i: 8 }, SEP: { n: '09', i: 9 },
  OCT: { n: '10', i: 10 }, NOV: { n: '11', i: 11 }, DIC: { n: '12', i: 12 },
}

const TX_DATE_RE = /^(\d{1,2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)$/i

// Amount at end of line: "$1,234.56" or "- $1,234.56" (credit)
const AMOUNT_RE = /(-\s*)?\$(\d{1,3}(?:,\d{3})*\.\d{2})$/

// Descriptions that are accounting adjustments, not real purchases
const SKIP_DESC_RE = /^(Saldo\s|Intereses\s|IVA\s+sobre|Abono\s+por\s+plan|Pagos\s+a\s+tu)/i

// Parse period header → { startMonth, startYear, endMonth, endYear }
function parsePeriod(text) {
  const m = text.match(
    /Periodo[^0-9]*(\d{1,2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+(\d{4})\s*[–\-]\s*\d{1,2}\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+(\d{4})/i
  )
  if (!m) return null
  return {
    startMonth: m[2].toUpperCase(),
    startYear: parseInt(m[3]),
    endMonth: m[4].toUpperCase(),
    endYear: parseInt(m[5]),
  }
}

// Given a transaction month + period info, resolve the correct year
function resolveYear(txMonthAbbr, period) {
  if (!period) return new Date().getFullYear()
  const txIdx   = MONTH_MAP[txMonthAbbr.toUpperCase()]?.i
  const startIdx = MONTH_MAP[period.startMonth]?.i

  // Same year across the whole period
  if (period.startYear === period.endYear) return period.startYear

  // Cross-year period (e.g. DIC 2025 → ENE 2026)
  return txIdx >= startIdx ? period.startYear : period.endYear
}

async function parseNuPDF(buffer) {
  let pdfData
  try {
    pdfData = await pdfParse(buffer)
  } catch {
    throw new Error('No se pudo leer el PDF. Asegúrate de que no esté protegido con contraseña.')
  }

  const text = pdfData.text
  const period = parsePeriod(text)
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Find where the transaction block starts (line after "TRANSACCIONES...")
  let txStart = 0
  for (let i = 0; i < lines.length; i++) {
    if (/^TRANSACCIONES/i.test(lines[i])) { txStart = i + 1; break }
  }

  const transactions = []

  for (let i = txStart; i < lines.length - 2; i++) {
    const line = lines[i]

    // Stop at end-of-transactions sentinel
    if (/^Saldo final del periodo/i.test(line)) break

    const dateMatch = line.match(TX_DATE_RE)
    if (!dateMatch) continue

    const day       = dateMatch[1].padStart(2, '0')
    const monthAbbr = dateMatch[2].toUpperCase()
    const month     = MONTH_MAP[monthAbbr]?.n
    if (!month) continue

    const year = resolveYear(monthAbbr, period)
    const date = `${year}-${month}-${day}`

    // i+1 = category label (ignored)
    // i+2 = description glued to amount
    const descAmountLine = lines[i + 2] || ''
    if (!descAmountLine) continue

    const amtMatch = descAmountLine.match(AMOUNT_RE)
    if (!amtMatch) continue

    const isCredit = Boolean(amtMatch[1])
    const amount   = parseFloat(amtMatch[2].replace(/,/g, ''))
    if (!amount || isNaN(amount)) continue

    // Description = everything before the matched amount string
    const desc = descAmountLine.slice(0, descAmountLine.length - amtMatch[0].length)
      .trim().toUpperCase()
    if (!desc || desc.length < 2) continue

    // Skip accounting adjustments and interest lines
    if (SKIP_DESC_RE.test(desc)) continue

    transactions.push({
      date,
      description: desc,
      amount: isCredit ? -amount : amount,
    })

    i += 2 // consumed category + descAmount lines
  }

  if (!transactions.length) {
    throw new Error(
      'No se encontraron movimientos en el PDF de Nu. ' +
      'Asegúrate de que sea un estado de cuenta de Nu México.'
    )
  }

  return transactions
}

module.exports = { parseNuPDF }
