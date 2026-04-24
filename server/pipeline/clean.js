// Merchant name normalization — strips location noise and PII residue
// Input: raw description string from parser
// Output: normalized merchant name safe to store and group by

const LOCATION_SUFFIXES = [
  /\bMEXICO\b/g, /\bMEXICO MX\b/g,
  /\bMTY\b/g, /\bMONTERREY\b/g, /\bNL\b/g,
  /\bCDMX\b/g, /\bCIUDAD DE MEX\b/g, /\bCD\s*DE\s*MEX\b/g,
  /\bGARZA GARCIA\b/g, /\bSAN PEDRO GARZA\b/g,
  /\bAPODACA\b/g, /\bGUADALUPE\b/g, /\bSANTA CATARINA\b/g,
  /\bGUADALAJARA\b/g, /\bGDL\b/g, /\bJAL\b/g,
  /\bCOAH\b/g, /\bSALTILLO\b/g, /\bTORREON\b/g,
  /\bDF\b/g, /\bCOL\s+\w+/g,
  /\bSA\s+DE\s+CV\b/g, /\bS\s*A\s*B?\b/g,
]

const STOPWORDS = [
  'SA DE CV', 'SAB DE CV', 'SAPI DE CV', 'S DE RL',
  'WEB', 'COM MX', 'COM', 'MX', 'SIN TARJETA QR',
]

// BBVA PDFs concatenate words when columns are adjacent — fix known patterns
// e.g. "SPEI RECIBIDOSANTANDER" → "SPEI RECIBIDO SANTANDER"
const CONCAT_FIXES = [
  // SPEI verbs glued to next word
  [/(RECIBIDO|ENVIADO|DEPOSITADO|REALIZADO)([A-ZÁÉÍÓÚÑ])/g, '$1 $2'],
  // Known bank names that appear concatenated
  [/([A-Z])(SANTANDER|BANORTE|BANREGIO|BANAMEX|BANCOMER|BANCOPPEL|SCOTIABANK|INBURSA|AFIRME|BANBAJIO|HSBC|NUBANK|CITI|CITIBANAMEX)(?=[^A-Z]|$)/g, '$1 $2'],
  // "PAGOBC" → "PAGO BC", "PAGOCARD" → "PAGO CARD" etc.
  [/(PAGO)(DE|TC|TDC|CARD|NOMINA|CUENTA)([A-Z])/g, '$1 $2 $3'],
]

function cleanMerchant(raw) {
  if (!raw) return 'DESCONOCIDO'
  let name = String(raw).toUpperCase().trim()

  // Fix BBVA concatenation artifacts before other processing
  for (const [re, repl] of CONCAT_FIXES) name = name.replace(re, repl)

  // Strip leftover RFC codes (parser should catch these but just in case)
  name = name.replace(/\bRFC[A-Z0-9]{10,13}\b/g, '')
  // Strip reference codes
  name = name.replace(/\/REF[A-Z0-9_~-]+/gi, '')
  // Strip numeric-heavy tokens (order IDs, terminals)
  name = name.replace(/\b[A-Z0-9]*\d{5,}[A-Z0-9]*\b/g, '')
  // Strip location suffixes
  for (const re of LOCATION_SUFFIXES) name = name.replace(re, '')
  // Strip stopwords
  for (const sw of STOPWORDS) name = name.replace(new RegExp(`\\b${sw}\\b`, 'g'), '')
  // Collapse whitespace
  name = name.replace(/\s+/g, ' ').trim()

  // Truncate to reasonable length
  if (name.length > 60) name = name.slice(0, 60).trim()

  return name || 'DESCONOCIDO'
}

module.exports = { cleanMerchant }
