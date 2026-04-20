const pdfParse = require('pdf-parse')

const SUPPORTED_BANKS = ['BBVA', 'AMEX', 'NU', 'SANTANDER', 'BANAMEX', 'HSBC', 'BANORTE', 'SCOTIABANK']

const FILENAME_SIGNALS = [
  { pattern: /bbva|bancomer/i, bank: 'BBVA' },
  { pattern: /amex|american.?express/i, bank: 'AMEX' },
  { pattern: /nu\b|nubank/i, bank: 'NU' },
  { pattern: /santander/i, bank: 'SANTANDER' },
  { pattern: /banamex|citibanamex/i, bank: 'BANAMEX' },
  { pattern: /hsbc/i, bank: 'HSBC' },
  { pattern: /banorte/i, bank: 'BANORTE' },
  { pattern: /scotiabank/i, bank: 'SCOTIABANK' },
]

const CONTENT_SIGNALS = [
  { pattern: /bbva\s*méxico|banco\s*bilbao|bancomer/i, bank: 'BBVA' },
  { pattern: /american\s*express|amex\s*méxico/i, bank: 'AMEX' },
  { pattern: /nu\s*méxico|nu\.com\.mx|nubankapp/i, bank: 'NU' },
  { pattern: /banco\s*santander\s*méxico|santander\.com\.mx/i, bank: 'SANTANDER' },
  { pattern: /citibanamex|banamex\.com/i, bank: 'BANAMEX' },
  { pattern: /hsbc\s*méxico|hsbc\.com\.mx/i, bank: 'HSBC' },
  { pattern: /banorte\.com|grupo\s*financiero\s*banorte/i, bank: 'BANORTE' },
  { pattern: /scotiabank\s*méxico|scotiabank\.com\.mx/i, bank: 'SCOTIABANK' },
]

async function detectBank(buffer, filename) {
  const name = (filename || '').toLowerCase()
  const ext = name.split('.').pop()

  // 1. filename signals
  for (const s of FILENAME_SIGNALS) {
    if (s.pattern.test(name)) return { bank: s.bank, confidence: 'filename' }
  }

  // 2. extension shortcuts
  if (ext === 'csv') return { bank: 'BBVA', confidence: 'extension' }
  if (ext === 'xlsx' || ext === 'xls') return { bank: 'AMEX', confidence: 'extension' }

  // 3. PDF content scan
  if (ext === 'pdf' && buffer) {
    try {
      const data = await pdfParse(buffer, { max: 2 })
      const text = data.text
      for (const s of CONTENT_SIGNALS) {
        if (s.pattern.test(text)) return { bank: s.bank, confidence: 'content' }
      }
      return { bank: null, confidence: 'unknown', preview: text.slice(0, 500) }
    } catch {
      return { bank: null, confidence: 'error' }
    }
  }

  return { bank: null, confidence: 'unknown' }
}

module.exports = { detectBank, SUPPORTED_BANKS }
