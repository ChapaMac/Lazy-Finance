const { insertTransactions } = require('../db/queries')
const { categorize } = require('./categorize')
const crypto = require('crypto')

function makeKey(bank, date, desc, amount) {
  return crypto.createHash('sha256').update(`${bank}|${date}|${desc.trim().toUpperCase()}|${Math.abs(amount).toFixed(2)}`).digest('hex').slice(0, 40)
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const BBVA_MERCHANTS = [
  { desc: 'WALMART SUPERCENTRO PEDREGAL', amount: 1842.50 },
  { desc: 'PEMEX SERVICIO PEDREGAL', amount: 950.00 },
  { desc: 'UBER EATS MEXICO', amount: 320.00 },
  { desc: 'STARBUCKS PLAZA UNIVERSIDAD', amount: 118.00 },
  { desc: 'FARMACIA DEL AHORRO CDA', amount: 450.00 },
  { desc: 'SORIANA REFORMA', amount: 1250.00 },
  { desc: 'UBER TRIP CDMX', amount: 85.00 },
  { desc: 'TELMEX INTERNET MENSUAL', amount: 599.00 },
  { desc: 'CFE SERVICIO LUZ', amount: 780.00 },
  { desc: 'GIMNASIO SMART FIT', amount: 399.00 },
  { desc: 'CINEPOLIS PERISUR', amount: 220.00 },
  { desc: 'HEB SUCURSAL NORTE', amount: 2100.00 },
  { desc: 'GASOLINERA SHELL INSURGENTES', amount: 1100.00 },
  { desc: 'RESTAURANTE EL CARDENAL', amount: 680.00 },
  { desc: 'ESTACIONAMIENTO CENTRO', amount: 80.00 },
  { desc: 'LABORATORIO CHOPO', amount: 950.00 },
  { desc: 'SPOTIFY MEXICO', amount: 99.00 },
  { desc: 'LIVERPOOL FASHION DRIVE', amount: 1890.00 },
  { desc: 'RAPPI ORDENES CDMX', amount: 450.00 },
  { desc: 'TELCEL RECARGA PREPAGO', amount: 200.00 },
  { desc: 'COSTCO WHOLESALE CDMX', amount: 3200.00 },
  { desc: 'DIDI TAXI CDMX', amount: 95.00 },
  { desc: 'DOMINOS PIZZA ONLINE', amount: 380.00 },
  { desc: 'ZARA PERISUR', amount: 1200.00 },
]

const AMEX_MERCHANTS = [
  { desc: 'NETFLIX.COM MX', amount: 219.00 },
  { desc: 'AMAZON.COM.MX', amount: 650.00 },
  { desc: 'AIRBNB CDMX', amount: 4500.00 },
  { desc: 'AEROMEXICO VUELO MTY', amount: 8200.00 },
  { desc: 'HOTEL CAMINO REAL', amount: 3800.00 },
  { desc: 'DISNEY PLUS MX', amount: 159.00 },
  { desc: 'APPLE SERVICES', amount: 99.00 },
  { desc: 'UBER EATS EXPRESS', amount: 280.00 },
  { desc: 'PALACIO DE HIERRO', amount: 2800.00 },
  { desc: 'COURSERA SUBSCRIPTION', amount: 649.00 },
  { desc: 'RESTAURANTE PUJOL', amount: 2400.00 },
  { desc: 'VOLARIS MDO', amount: 3100.00 },
  { desc: 'HBO MAX MENSUAL', amount: 149.00 },
  { desc: 'BOOKING.COM HOTEL', amount: 2200.00 },
  { desc: 'TICKETMASTER MX', amount: 890.00 },
]

function generateTransactions() {
  const transactions = []

  for (let i = 0; i < 120; i++) {
    const merchant = BBVA_MERCHANTS[Math.floor(Math.random() * BBVA_MERCHANTS.length)]
    const variance = 0.7 + Math.random() * 0.6
    const amount = parseFloat((merchant.amount * variance).toFixed(2))
    const date = daysAgo(Math.floor(Math.random() * 180))
    const desc = merchant.desc
    transactions.push({
      date,
      description: desc,
      amount,
      currency: 'MXN',
      bank: 'BBVA',
      category: categorize(desc),
      category_overridden: 0,
      notes: null,
      unique_key: makeKey('BBVA', date, desc + i, amount),
    })
  }

  for (let i = 0; i < 60; i++) {
    const merchant = AMEX_MERCHANTS[Math.floor(Math.random() * AMEX_MERCHANTS.length)]
    const variance = 0.85 + Math.random() * 0.3
    const amount = parseFloat((merchant.amount * variance).toFixed(2))
    const date = daysAgo(Math.floor(Math.random() * 180))
    const desc = merchant.desc
    transactions.push({
      date,
      description: desc,
      amount,
      currency: 'MXN',
      bank: 'AMEX',
      category: categorize(desc),
      category_overridden: 0,
      notes: null,
      unique_key: makeKey('AMEX', date, desc + i, amount),
    })
  }

  return transactions
}

function seedIfEmpty() {
  const { hasAnyTransactions, getUserByUsername } = require('../db/queries')
  const { getDb } = require('../db/schema')
  // Solo sembrar datos de muestra si no hay ningún usuario registrado
  const userCount = getDb().prepare('SELECT COUNT(*) as count FROM users').get().count
  if (userCount === 0 && !hasAnyTransactions()) {
    const txs = generateTransactions()
    const result = insertTransactions(txs)
    console.log(`✅ Seeded ${result.inserted} sample transactions`)
  }
}

module.exports = { seedIfEmpty }
