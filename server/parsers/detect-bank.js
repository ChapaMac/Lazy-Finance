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
  // BBVA must come first — statements contain "AMERICAN EXPRESS" as merchant name
  { pattern: /bbva\s*m[eé]xico|banco\s*bilbao|bancomer|grupo\s*financiero\s*bbva|bba830831/i, bank: 'BBVA' },
  // AmEx: only match when it appears as the issuing bank, not as a merchant payment
  { pattern: /american\s*express.*estado\s*de\s*cuenta|amex\s*m[eé]xico|americanexpress\.com\.mx/i, bank: 'AMEX' },
  { pattern: /nu\s*m[eé]xico|nu\.com\.mx|nubankapp/i, bank: 'NU' },
  { pattern: /banco\s*santander\s*m[eé]xico|santander\.com\.mx/i, bank: 'SANTANDER' },
  { pattern: /citibanamex|banamex\.com/i, bank: 'BANAMEX' },
  { pattern: /hsbc\s*m[eé]xico|hsbc\.com\.mx/i, bank: 'HSBC' },
  { pattern: /banorte\.com|grupo\s*financiero\s*banorte/i, bank: 'BANORTE' },
  { pattern: /scotiabank\s*m[eé]xico|scotiabank\.com\.mx/i, bank: 'SCOTIABANK' },
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
