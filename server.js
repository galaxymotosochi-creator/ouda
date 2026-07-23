const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const sharp = require('sharp')
const app = express()

app.use(cors())
app.use(express.json())

const UPLOAD_DIR = '/opt/ouda-site/uploads'
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only images allowed'), false)
  }
})

// === File persistence ===
const DATA_DIR = '/opt/ouda-api/data'
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

function loadData(name, fallback) {
  const file = path.join(DATA_DIR, name + '.json')
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'))
    }
  } catch (e) { console.error('Load error', name, e.message) }
  return fallback
}

function saveData(name, data) {
  const file = path.join(DATA_DIR, name + '.json')
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
  } catch (e) { console.error('Save error', name, e.message) }
}

// === Initial data ===
let products = loadData('products', [
  { id: 1, name: 'OUDA Street 50', price: 79900, image: '/placeholder.svg', power: '3.7 кВт', fuel: 'Бензин АИ-92', cooling: 'Воздушное', max_speed: '65 км/ч', wheels: '10"', description: '', colors: [
      { name: 'Чёрный', hex: '#1a1a1a' }, { name: 'Белый', hex: '#f0f0f0' }, { name: 'Красный', hex: '#c23a2b' },
    ]},
  { id: 2, name: 'OUDA Sport 125', price: 129900, image: '/placeholder.svg', power: '8.2 кВт', fuel: 'Бензин АИ-95', cooling: 'Жидкостное', max_speed: '95 км/ч', wheels: '12"', description: '', colors: [
      { name: 'Красный', hex: '#c23a2b' }, { name: 'Синий', hex: '#1a3a6b' }, { name: 'Чёрный матовый', hex: '#2a2a2a' },
    ]},
  { id: 3, name: 'OUDA Electric', price: 99900, image: '/placeholder.svg', power: '2000 Вт', fuel: 'Электро', cooling: 'Воздушное', max_speed: '75 км/ч', wheels: '10"', description: '', colors: [
      { name: 'Белый', hex: '#f0f0f0' }, { name: 'Серый матовый', hex: '#6a6a6a' }, { name: 'Синий матовый', hex: '#1a2a4b' }, { name: 'Хамелеон', hex: 'chameleon' },
    ]},
])
let orders = loadData('orders', [])
let stock = loadData('stock', [
  { id: 1, product_id: 1, product_name: 'OUDA Street 50', date: '2026-07-15', status: 'received', expected_date: null, colors: { 'Чёрный': 5, 'Белый': 3, 'Красный': 2 } },
  { id: 2, product_id: 3, product_name: 'OUDA Electric', date: '2026-07-20', status: 'transit', expected_date: '2026-08-05', colors: { 'Белый': 10, 'Хамелеон': 5 } },
  { id: 3, product_id: 1, product_name: 'OUDA Street 50', date: '2026-07-20', status: 'transit', expected_date: '2026-08-10', colors: { 'Чёрный': 10, 'Красный': 5 } },
])
let shipments = loadData('shipments', [])
let nextId = loadData('nextId', 100)
let shipmentCounter = loadData('shipmentCounter', 0)

function saveAll() {
  saveData('products', products)
  saveData('orders', orders)
  saveData('stock', stock)
  saveData('shipments', shipments)
  saveData('nextId', nextId)
  saveData('shipmentCounter', shipmentCounter)
}

// === Stock computation ===
function computeAvailableStock() {
  const available = {}
  stock.filter(s => s.status === 'received').forEach(s => {
    Object.entries(s.colors || {}).forEach(([color, qty]) => {
      const key = s.product_id + ':' + color
      available[key] = (available[key] || 0) + qty
    })
  })
  shipments.filter(s => s.status !== 'отменено').forEach(s => {
    (s.items || []).forEach(item => {
      const key = item.product_id + ':' + item.color
      available[key] = (available[key] || 0) - item.qty
    })
  })
  return available
}

function getEnrichedProducts() {
  const avail = computeAvailableStock()
  return products.map(p => {
    const productStock = stock.filter(s => s.product_id === p.id)
    const received = productStock.some(s => s.status === 'received')
    const transit = productStock.filter(s => s.status === 'transit')
    const totalTransit = transit.reduce((sum, s) => sum + Object.values(s.colors || {}).reduce((a, b) => a + b, 0), 0)
    const earliestTransit = transit.sort((a, b) => new Date(a.expected_date) - new Date(b.expected_date))[0]
    const colorsAvailable = {}
    // Build from stock entries (not from product template)
    const prefix = p.id + ':'
    Object.entries(avail).forEach(([key, qty]) => {
      if (key.startsWith(prefix)) {
        const colorName = key.slice(prefix.length)
        if (colorName) colorsAvailable[colorName] = qty
      }
    })
    // Also include colors from stock entries (even if received=0, for display)
    stock.filter(s => s.product_id === p.id).forEach(s => {
      Object.keys(s.colors || {}).forEach(color => {
        if (!(color in colorsAvailable)) colorsAvailable[color] = 0
      })
    })
    const incoming = transit.map(t => ({
      date: t.expected_date || null,
      colors: t.colors || {},
    }))
    return {
      ...p, in_stock: received, expected_qty: totalTransit || null,
      expected_date: earliestTransit?.expected_date || null, available_colors: colorsAvailable,
      incoming,
    }
  })
}

// === Products ===
app.get('/api/products', (req, res) => res.json(getEnrichedProducts()))
app.post('/api/products', (req, res) => {
  const p = { id: nextId++, ...req.body, colors: [] }
  products.unshift(p)
  saveAll()
  res.json(p)
})
app.delete('/api/products/:id', (req, res) => {
  products = products.filter(p => p.id != req.params.id)
  saveAll()
  res.json({ ok: true })
})
app.patch('/api/products/:id', (req, res) => {
  const p = products.find(p => p.id == req.params.id)
  if (!p) return res.status(404).json({ error: 'not found' })
  Object.assign(p, req.body)
  saveAll()
  res.json(p)
})

// === Orders ===
app.get('/api/orders', (req, res) => res.json(orders))
app.post('/api/orders', (req, res) => {
  const o = { id: nextId++, ...req.body, status: 'new', created_at: new Date().toISOString() }
  orders.unshift(o)
  saveAll()
  res.json(o)
})
app.patch('/api/orders/:id', (req, res) => {
  const o = orders.find(o => o.id == req.params.id)
  if (o) Object.assign(o, req.body)
  saveAll()
  res.json(o || { error: 'not found' })
})

// === Stock ===
app.get('/api/stock', (req, res) => res.json(stock))
app.post('/api/stock', (req, res) => {
  const s = { id: nextId++, ...req.body }
  stock.unshift(s)
  saveAll()
  res.json(s)
})

// === Receive stock (partial/full) ===
app.patch('/api/stock/:id/receive', (req, res) => {
  const idx = stock.findIndex(s => s.id == req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })
  const entry = stock[idx]
  if (entry.status !== 'transit') return res.status(400).json({ error: 'not in transit' })

  const { receivedColors } = req.body // { 'Чёрный': 5, 'Красный': 3 }
  if (!receivedColors || Object.keys(receivedColors).length === 0)
    return res.status(400).json({ error: 'no colors specified' })

  const today = new Date().toISOString().slice(0, 10)

  // Check if we're receiving all items
  let allReceived = true
  const remainingColors = {}
  Object.entries(entry.colors || {}).forEach(([color, qty]) => {
    const rcv = receivedColors[color] || 0
    const remaining = qty - rcv
    if (remaining > 0) {
      allReceived = false
      remainingColors[color] = remaining
    } else if (remaining < 0) {
      return res.status(400).json({ error: `received more than in transit for ${color}` })
    }
  })

  if (allReceived) {
    // Full receive — just change status
    entry.status = 'received'
    entry.date = today
    stock[idx] = entry
    saveAll()
    return res.json({ action: 'full', entry })
  }

  // Partial receive — reduce transit, create received entry
  entry.colors = remainingColors
  // Remove colors with 0 qty
  Object.keys(entry.colors).forEach(c => { if (entry.colors[c] <= 0) delete entry.colors[c] })
  stock[idx] = entry

  const newEntry = {
    id: nextId++,
    product_id: entry.product_id,
    product_name: entry.product_name,
    date: today,
    status: 'received',
    expected_date: null,
    colors: receivedColors,
  }
  stock.unshift(newEntry)
  saveAll()
  res.json({ action: 'partial', transit: entry, received: newEntry })
})

// === Shipments ===
app.get('/api/shipments', (req, res) => res.json(shipments))
app.get('/api/shipments/:id', (req, res) => {
  const s = shipments.find(s => s.id == req.params.id)
  if (!s) return res.status(404).json({ error: 'not found' })
  res.json(s)
})
app.post('/api/shipments', (req, res) => {
  // Use order id as number when created from order, otherwise use counter
  const number = req.body.order_number
    ? 'OUDA-' + String(req.body.order_number).padStart(3, '0')
    : (shipmentCounter++ , 'OUDA-' + String(shipmentCounter).padStart(3, '0'))
  const s = {
    id: nextId++, number, created_at: req.body.date ? new Date(req.body.date + 'T12:00:00Z').toISOString() : new Date().toISOString(),
    status: 'оформлено', prepaid: 0, paid: 0, ...req.body,
  }
  if (s.order_id) {
    const order = orders.find(o => o.id == s.order_id)
    if (order && !s.client) {
      s.client = { name: order.name, phone: order.phone, city: order.city || '' }
    }
  }
  shipments.unshift(s)
  saveAll()
  res.json(s)
})
app.patch('/api/shipments/:id', (req, res) => {
  const s = shipments.find(s => s.id == req.params.id)
  if (!s) return res.status(404).json({ error: 'not found' })
  Object.assign(s, req.body)
  saveAll()
  res.json(s)
})

// Upload images
app.post('/api/upload', upload.array('photos', 7), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' })
    const urls = []
    for (const file of req.files) {
      const ext = path.extname(file.originalname) || '.jpg'
      const filename = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext
      const outputPath = path.join(UPLOAD_DIR, filename)
      // Compress with sharp: max 1200px, quality 80
      await sharp(file.buffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(outputPath)
      urls.push('/uploads/' + filename)
    }
    res.json({ urls })
  } catch (e) {
    console.error('Upload error:', e)
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/stock/available', (req, res) => res.json(computeAvailableStock()))

const PORT = process.env.PORT || 3002
app.listen(PORT, '127.0.0.1', () => console.log('OUDA API on port', PORT))

// === Stock Details (остатки) ===
app.get('/api/stock/details', (req, res) => {
  const details = products.map(p => {
    const colorDetails = {}
    // Build colors from stock entries (not from product template)
    stock.filter(s => s.product_id === p.id).forEach(s => {
      Object.entries(s.colors || {}).forEach(([color, qty]) => {
        if (!colorDetails[color]) {
          colorDetails[color] = { color, hex: '#888', received: 0, shipped: 0, available: 0 }
        }
      })
    })
    // Sum received stock
    stock.filter(s => s.product_id === p.id && s.status === 'received').forEach(s => {
      Object.entries(s.colors || {}).forEach(([color, qty]) => {
        if (colorDetails[color]) colorDetails[color].received += qty
      })
    })
    // Sum in-transit stock
    stock.filter(s => s.product_id === p.id && s.status === 'transit').forEach(s => {
      Object.entries(s.colors || {}).forEach(([color, qty]) => {
        if (colorDetails[color]) colorDetails[color].inTransit = (colorDetails[color].inTransit || 0) + qty
        if (s.expected_date) colorDetails[color].expected_date = s.expected_date
      })
    })
    // Sum shipped (non-cancelled)
    shipments.filter(s => s.status !== 'отменено').forEach(s => {
      (s.items || []).forEach(item => {
        if (item.product_id === p.id && colorDetails[item.color]) {
          colorDetails[item.color].shipped += item.qty
        }
      })
    })
    // Compute available
    Object.values(colorDetails).forEach(cd => cd.available = cd.received - cd.shipped)

    const colors = Object.values(colorDetails)
    const totalReceived = colors.reduce((s, c) => s + c.received, 0)
    const totalShipped = colors.reduce((s, c) => s + c.shipped, 0)
    const totalAvailable = colors.reduce((s, c) => s + c.available, 0)
    const totalInTransit = colors.reduce((s, c) => s + (c.inTransit || 0), 0)

    return {
      product_id: p.id,
      product_name: p.name,
      colors,
      totalReceived,
      totalShipped,
      totalAvailable,
      totalInTransit,
    }
  })
  res.json(details)
})
