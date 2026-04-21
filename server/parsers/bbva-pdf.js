const pdfParse = require('pdf-parse')

// BBVA México PDF format (observed):
// Date line: "05/MAR05/MAR" (oper date + liq date concatenated, no space)
// Next line: description e.g. "SPEI ENVIADO BANORTE"
// Next line: amounts concatenated e.g. "38.0010,740.0810,740.08" (cargo/abono + saldo_oper + saldo_liq)
//            OR single amount e.g. "5,370.00" (deposits sometimes omit saldo columns)
// Debit vs credit determined by saldo movement; falls back to description keywords.

const MONTH_MAP = {
  ENE: '01', FEB: '02', MAR: '03', ABR: '04', MAY: '05', JUN: '06',
  JUL: '07', AGO: '08', SEP: '09', OCT: '10', NOV: '11', DIC: '12',
}

const DATE_LINE_RE = /^(\d{2})\/(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)/i

const CREDIT_KEYWORDS = /RECIBIDO|DEPOSITO|ABONO|NOMINA|INTERES|RENDIMIENTO/i

function extractAmounts(str) {
  return [...str.matchAll(/(\d{1,3}(?:,\d{3})*\.\d{2})/g)]
    .map(m => parseFloat(m[1].replace(/,/g, '')))
}

function extractYear(text) {
  const periodRe = [
    /per[ií]odo[^0-9]*(20\d{2})/i,
    /del\s+\d{1,2}\s+de\s+\w+(?:\s+de)?\s+(20\d{2})/i,
    /\d{2}\/(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\/(20\d{2})/i,
    /\d{1,2}\/\d{1,2}\/(20\d{2})/,
    /corte[^0-9]*(20\d{2})/i,
  ]
  const contextYears = periodRe.flatMap(r => { const m = text.match(r); return m ? [m[m.length - 1]] : [] })
  if (contextYears.length) return contextYears.sort()[0]

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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const dateMatch = line.match(DATE_LINE_RE)
    if (!dateMatch) continue

    const day = dateMatch[1]
    const month = MONTH_MAP[dateMatch[2].toUpperCase()]
    if (!month) continue
    const date = `${year}-${month}-${day}`

    const descLine = lines[i + 1] || ''
    if (!descLine || DATE_LINE_RE.test(descLine)) continue

    const amountLine = lines[i + 2] || ''
    const amounts = extractAmounts(amountLine)
    if (!amounts.length) continue

    const txAmount = amounts[0]
    if (!txAmount) continue

    const saldoOper = amounts.length >= 2 ? amounts[1] : null

    let isCredit = false
    if (saldoOper !== null && prevSaldo !== null) {
      const diffIfCredit = Math.abs((prevSaldo + txAmount) - saldoOper)
      const diffIfDebit = Math.abs((prevSaldo - txAmount) - saldoOper)
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
