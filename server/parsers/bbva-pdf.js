const pdfParse = require('pdf-parse')

// BBVA México PDF format (observed from real statements):
//
// NEW (single-line) format:
//   "05/AGO 05/AGO SPEI RECIBIDOSANTANDER 39,987.69"
//   "05/AGO 05/AGO AMERICAN EXPRESS 39,872.00 215.69 215.69"
//   "14/AGO 14/AGO PAGO DE NOMINA 12,882.34"
//
// Each line: DD/MMM DD/MMM DESCRIPTION [txAmount] [saldoOper] [saldoLiq]
//   - 1 amount  → credit/debit determined by CREDIT_KEYWORDS
//   - 2-3 amounts → txAmount + saldoOper available → use balance tracking
//
// LEGACY (multi-line) format also handled:
//   Line i:   "05/MAR05/MAR"
//   Line i+1: description
//   Line i+2: amounts concatenated

const MONTH_MAP = {
  ENE: '01', FEB: '02', MAR: '03', ABR: '04', MAY: '05', JUN: '06',
  JUL: '07', AGO: '08', SEP: '09', OCT: '10', NOV: '11', DIC: '12',
}

const MONTH_NAMES = Object.keys(MONTH_MAP).join('|')

// NEW format: "DD/MMM DD/MMM rest..."  (space between the two date fields)
const NEWLINE_RE = new RegExp(
  `^(\\d{2})/(${MONTH_NAMES})\\s+\\d{2}/(?:${MONTH_NAMES})\\s+(.+)$`,
  'i'
)

// LEGACY format: "DD/MMMDD/MMM" (no space, concatenated)
const LEGACY_DATE_RE = new RegExp(
  `^(\\d{2})/(${MONTH_NAMES})(\\d{2}/(?:${MONTH_NAMES}))`,
  'i'
)

const CREDIT_KEYWORDS = /RECIBIDO|DEPOSITO|ABONO|NOMINA|INTERES|RENDIMIENTO/i

// Extract all dollar amounts from a string (right-to-left greedy)
function extractAmounts(str) {
  return [...str.matchAll(/(\d{1,3}(?:,\d{3})*\.\d{2})/g)]
    .map(m => parseFloat(m[1].replace(/,/g, '')))
}

// Strip trailing amounts and return { desc, amounts }
function splitDescAmounts(rest) {
  // Amounts always appear at the END of the rest string
  // Walk backward: as long as the last token matches amount pattern, pop it
  const tokens = rest.trim().split(/\s+/)
  const amounts = []
  while (tokens.length) {
    const last = tokens[tokens.length - 1]
    if (/^\d{1,3}(?:,\d{3})*\.\d{2}$/.test(last)) {
      amounts.unshift(parseFloat(last.replace(/,/g, '')))
      tokens.pop()
    } else {
      break
    }
  }
  return { desc: tokens.join(' '), amounts }
}

function extractYear(text) {
  // Collect all DD/MM/YYYY style dates from the full text (most reliable for BBVA)
  // These appear in the header: "DEL 05/08/2025 AL 04/09/2025", "Fecha de Corte 04/09/2025"
  const numericDateYears = [...text.matchAll(/\b\d{1,2}\/\d{1,2}\/(20\d{2})\b/g)].map(m => m[1])

  // Also look for DD/MMM/YYYY if present
  const abbrDateYears = [...text.matchAll(/\d{2}\/(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\/(20\d{2})/gi)].map(m => m[2])

  // Keyword-anchored patterns (allow digits between keyword and year)
  const keywordRe = [
    /per[ií]odo.{0,40}?(20\d{2})/i,
    /corte.{0,20}?(20\d{2})/i,
    /del\s+\d{1,2}\s+de\s+\w+.{0,10}?(20\d{2})/i,
  ]
  const keywordYears = keywordRe.flatMap(r => { const m = text.match(r); return m ? [m[1]] : [] })

  // All candidate years from high-confidence sources
  const allCandidates = [...keywordYears, ...numericDateYears, ...abbrDateYears]
  if (allCandidates.length) {
    // Return the most frequent; ties broken by most recent
    const freq = {}
    for (const y of allCandidates) freq[y] = (freq[y] || 0) + 1
    return Object.entries(freq).sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0][0]
  }

  // Last resort: most frequent 20XX in entire text
  const freq = {}
  for (const y of (text.match(/20\d{2}/g) || [])) freq[y] = (freq[y] || 0) + 1
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || String(new Date().getFullYear())
}

function extractInitialSaldo(lines) {
  for (const line of lines) {
    const m = line.match(/Saldo\s*Inicial\s*([\d,]+\.\d{2})/i)
    if (m) return parseFloat(m[1].replace(/,/g, ''))
  }
  return null
}

async function parseBBVAPDF(buffer, yearOverride = null) {
  let pdfData
  try {
    pdfData = await pdfParse(buffer)
  } catch {
    throw new Error('No se pudo leer el PDF. Asegúrate de que no esté protegido con contraseña.')
  }

  const text = pdfData.text
  const year = yearOverride ? String(yearOverride) : extractYear(text)
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const initialSaldo = extractInitialSaldo(lines)

  const transactions = []
  let prevSaldo = initialSaldo

  // ── NEW single-line format ─────────────────────────────────────────────────
  let parsed = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(NEWLINE_RE)
    if (!m) continue

    const day   = m[1].padStart(2, '0')
    const month = MONTH_MAP[m[2].toUpperCase()]
    if (!month) continue
    const date  = `${year}-${month}-${day}`

    const { desc: rawDesc, amounts } = splitDescAmounts(m[3])
    if (!amounts.length) continue

    const txAmount  = amounts[0]
    const saldoOper = amounts.length >= 2 ? amounts[1] : null

    if (!txAmount || isNaN(txAmount)) continue

    let isCredit = false
    if (saldoOper !== null && prevSaldo !== null) {
      const diffIfCredit = Math.abs((prevSaldo + txAmount) - saldoOper)
      const diffIfDebit  = Math.abs((prevSaldo - txAmount) - saldoOper)
      isCredit = diffIfCredit < diffIfDebit
    } else {
      isCredit = CREDIT_KEYWORDS.test(rawDesc)
    }

    if (saldoOper !== null) {
      prevSaldo = saldoOper
    } else if (prevSaldo !== null) {
      prevSaldo = isCredit ? prevSaldo + txAmount : prevSaldo - txAmount
    }

    const description = rawDesc.replace(/\s+/g, ' ').trim().toUpperCase()
    if (!description || description.length < 2) continue

    transactions.push({
      date,
      description,
      amount: isCredit ? -txAmount : txAmount,
    })
    parsed++
  }

  // ── LEGACY multi-line format fallback ──────────────────────────────────────
  if (parsed === 0) {
    prevSaldo = initialSaldo
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lm = line.match(LEGACY_DATE_RE)
      if (!lm) continue

      const day   = lm[1].padStart(2, '0')
      const month = MONTH_MAP[lm[2].toUpperCase()]
      if (!month) continue
      const date = `${year}-${month}-${day}`

      const descLine   = lines[i + 1] || ''
      if (!descLine || LEGACY_DATE_RE.test(descLine)) continue

      const amountLine = lines[i + 2] || ''
      const amounts    = extractAmounts(amountLine)
      if (!amounts.length) continue

      const txAmount  = amounts[0]
      const saldoOper = amounts.length >= 2 ? amounts[1] : null
      if (!txAmount) continue

      let isCredit = false
      if (saldoOper !== null && prevSaldo !== null) {
        const diffIfCredit = Math.abs((prevSaldo + txAmount) - saldoOper)
        const diffIfDebit  = Math.abs((prevSaldo - txAmount) - saldoOper)
        isCredit = diffIfCredit < diffIfDebit
      } else {
        isCredit = CREDIT_KEYWORDS.test(descLine)
      }

      if (saldoOper !== null) {
        prevSaldo = saldoOper
      } else if (prevSaldo !== null) {
        prevSaldo = isCredit ? prevSaldo + txAmount : prevSaldo - txAmount
      }

      const description = descLine.replace(/\s+/g, ' ').trim().toUpperCase()
      if (!description || description.length < 2) continue

      transactions.push({
        date,
        description,
        amount: isCredit ? -txAmount : txAmount,
      })
    }
  }

  if (!transactions.length) {
    throw new Error(
      'No se encontraron movimientos en el PDF de BBVA. ' +
      'Asegúrate de que el PDF sea un estado de cuenta de BBVA México. ' +
      'Si el formato no es reconocido, descarga el estado en CSV desde BBVA en Línea.'
    )
  }

  return transactions
}

module.exports = { parseBBVAPDF }
