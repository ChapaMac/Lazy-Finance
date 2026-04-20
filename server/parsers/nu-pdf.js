const pdfParse = require('pdf-parse')

// Nu México PDF — parser stub
// Needs a real statement to calibrate. Returns empty until calibrated.
async function parseNuPDF(buffer) {
  const data = await pdfParse(buffer)
  const text = data.text
  // TODO: implement once we have a sample statement
  // Use /uploads/debug-pdf to inspect the raw text structure
  throw new Error('Parser de Nu en construcción — sube el PDF por /uploads/debug-pdf para ver su estructura')
}

module.exports = { parseNuPDF }
