const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../database.sqlite')
let db

function getDb() {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

function initSchema() {
  const database = getDb()

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'MXN',
      bank TEXT NOT NULL,
      category TEXT DEFAULT 'Otros',
      category_overridden INTEGER DEFAULT 0,
      notes TEXT,
      unique_key TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_tx_bank ON transactions(bank);
    CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category);
    CREATE INDEX IF NOT EXISTS idx_tx_unique ON transactions(unique_key);
  `)

  database.exec(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT UNIQUE NOT NULL,
      monthly_limit REAL NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS merchant_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  return database
}

// Removes the CHECK(bank IN ('BBVA','AMEX')) constraint so manual/cash entries can be added
function migrateExpandBankOptions() {
  const db = getDb()
  try {
    const testKey = '__bank_constraint_test__'
    db.prepare(`INSERT INTO transactions (date, description, amount, bank, unique_key) VALUES ('2000-01-01', 'test', 0, 'Efectivo', ?)`).run(testKey)
    db.prepare(`DELETE FROM transactions WHERE unique_key = ?`).run(testKey)
  } catch {
    // CHECK constraint still present — recreate the table without it
    db.exec(`
      ALTER TABLE transactions RENAME TO _transactions_old;
      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'MXN',
        bank TEXT NOT NULL,
        category TEXT DEFAULT 'Otros',
        category_overridden INTEGER DEFAULT 0,
        notes TEXT,
        unique_key TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO transactions SELECT * FROM _transactions_old;
      DROP TABLE _transactions_old;
      CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_tx_bank ON transactions(bank);
      CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category);
      CREATE INDEX IF NOT EXISTS idx_tx_unique ON transactions(unique_key);
    `)
  }
}

function migrateAddUserId() {
  const db = getDb()

  // transactions — simple ADD COLUMN, no unique constraint issue
  const txCols = db.prepare("PRAGMA table_info(transactions)").all().map(c => c.name)
  if (!txCols.includes('user_id')) {
    db.exec(`ALTER TABLE transactions ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id)`)
  }

  // budgets — has UNIQUE(category), need to recreate with UNIQUE(user_id, category)
  const budgetCols = db.prepare("PRAGMA table_info(budgets)").all().map(c => c.name)
  if (!budgetCols.includes('user_id')) {
    db.exec(`
      ALTER TABLE budgets RENAME TO _budgets_old;
      CREATE TABLE budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        monthly_limit REAL NOT NULL,
        user_id INTEGER NOT NULL DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, category)
      );
      INSERT INTO budgets (id, category, monthly_limit, user_id, updated_at)
        SELECT id, category, monthly_limit, 1, updated_at FROM _budgets_old;
      DROP TABLE _budgets_old;
    `)
  }

  // merchant_rules — has UNIQUE(pattern), need to recreate with UNIQUE(user_id, pattern)
  const mrCols = db.prepare("PRAGMA table_info(merchant_rules)").all().map(c => c.name)
  if (!mrCols.includes('user_id')) {
    db.exec(`
      ALTER TABLE merchant_rules RENAME TO _mr_old;
      CREATE TABLE merchant_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT NOT NULL,
        category TEXT NOT NULL,
        user_id INTEGER NOT NULL DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, pattern)
      );
      INSERT INTO merchant_rules (id, pattern, category, user_id, updated_at)
        SELECT id, pattern, category, 1, updated_at FROM _mr_old;
      DROP TABLE _mr_old;
    `)
  }
}

module.exports = { getDb, initSchema, migrateExpandBankOptions, migrateAddUserId }
