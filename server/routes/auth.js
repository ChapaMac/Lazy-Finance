const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { getUserByUsername, createUser } = require('../db/queries')
const { authMiddleware, JWT_SECRET } = require('../middleware/auth')

const router = express.Router()

router.post('/register', async (req, res) => {
  const { username, password } = req.body
  if (!username?.trim() || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' })
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })

  const existing = getUserByUsername(username.trim())
  if (existing) return res.status(409).json({ error: 'El usuario ya existe' })

  const hash = await bcrypt.hash(password, 12)
  createUser(username.trim(), hash)

  const user = getUserByUsername(username.trim())
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' })
  res.json({ token, user: { id: user.id, username: user.username } })
})

router.post('/login', async (req, res) => {
  const { username, password } = req.body
  if (!username?.trim() || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' })

  const user = getUserByUsername(username.trim())
  if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' })
  res.json({ token, user: { id: user.id, username: user.username } })
})

router.get('/me', authMiddleware, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username })
})

module.exports = router
