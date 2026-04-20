const pdfParse = require('pdf-parse')

const MONTHS = {
  enero: '01', febrero: '02', marzo: '03', abril: '04',
  mayo: '05', junio: '06', julio: '07', agosto: '08',
  septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
}

// AmEx México PDF format (observed):
// Date and description are concatenated WITHOUT space:
//   "17 de FebreroPAGO RECIBIDO, GRACIAS10,000.00"
//   "16 de FebreroHEB MTY EL URO          MEXICO"
//     followed by "RFCSIH9511279T7" then "251.90" on its own line
// Credits have "CR" on the line immediately after the amount.

const DATE_RE = /^(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i

const SKIP_DESC = ['MONTO A DIFERIR', 'MESES EN AUTOM', 'CARGO 0', 'PAGO RECIBIDO']

function extractYear(text) {
  const freq = {}
  for (const y of (text.match(/20\d{2}/g) || [])) freq[y] = (freq[y] || 0) + 1
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || String(new Date().getFullYear())
}

function isStandaloneAmount(line) {
  return /^\d{1,3}(?:,\d{3})*\.\d{2}$/.test(line)
}

function parseFloat2(str) {
  return parseFloat(String(str).replace(/,/g, ''))
}

async function parseAmExPDF(buffer) {
  let pdfData
  try {
    pdfData = await pdfParse(buffer)
  } catch {
    throw new Error('No se pudo leer el PDF. Verifica que no esté protegido con contraseña.')
  }

  const text = pdfData.text
  const year = extractYear(text)
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  const transactions = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const dateMatch = line.match(DATE_RE)
    if (!dateMatch) continue

    const day = dateMatch[1].padStart(2, '0')
    const month = MONTHS[dateMatch[2].toLowerCase()]
    if (!month) continue
    const date = `${year}-${month}-${day}`

    // Everything after the month name (e.g. after "Febrero") is description+possibly amount
    const afterDate = line.slice(dateMatch[0].length)

    // Try to find amount at the END of this line (may be glued to description)
    // Pattern: amount at end, optional CR
    const endAmountRe = /(\d{1,3}(?:,\d{3})*\.\d{2})\s*(CR)?$/
    const endMatch = afterDate.match(endAmountRe)

    let amount = null
    let isCredit = false
    let desc = ''

    if (endMatch) {
      amount = parseFloat2(endMatch[1])
      isCredit = endMatch[2] === 'CR'
      desc = afterDate.slice(0, afterDate.lastIndexOf(endMatch[1]))
    } else {
      // Amount is on a subsequent line — look ahead up to 3 lines
      desc = afterDate
      for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
        const next = lines[j]
        if (DATE_RE.test(next)) break           // hit next transaction
        if (next === 'CR') { isCredit = true; continue }
        if (/^RFC/i.test(next)) continue        // skip RFC tax ID line
        if (/\/REF/i.test(next)) continue       // skip reference codes
        if (/Dólar U\.S\.A\./i.test(next)) continue // skip FX detail line
        if (isStandaloneAmount(next)) {
          amount = parseFloat2(next)
          // Check if line after amount is CR
          if (j + 1 < lines.length && lines[j + 1] === 'CR') isCredit = true
          break
        }
      }
    }

    if (amount === null || isNaN(amount) || amount === 0) continue

    // Clean description: collapse spaces, strip RFC / REF artifacts
    desc = desc
      .replace(/RFC[A-Z0-9]+/gi, '')
      .replace(/\/REF[A-Z0-9_~-]+/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase()

    if (!desc || desc.length < 2) continue
    if (SKIP_DESC.some(s => desc.includes(s))) continue

    transactions.push({ date, description: desc, amount: isCredit ? -amount : amount })
  }

  if (!transactions.length) {
    throw new Error(
      'No se encontraron movimientos en el PDF de American Express.\n' +
      'Intenta descargar el estado en formato Excel (XLSX) desde ' +
      'americanexpress.com.mx → Estado de Cuenta → Descargar → Excel.'
    )
  }

  return transactions
}

async function detectBankFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer)
    const t = data.text.toUpperCase()
    if (t.includes('AMERICAN EXPRESS') || t.includes('AMERICANEXPRESS')) return 'AMEX'
    if (t.includes('BBVA') || t.includes('BANCOMER')) return 'BBVA'
  } catch { /* ignore */ }
  return null
}

module.exports = { parseAmExPDF, detectBankFromPDF }
