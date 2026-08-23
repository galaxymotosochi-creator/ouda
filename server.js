const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const sharp = require('sharp')
const { sendTelegram, sendTelegramTo, setWebhook } = require('./telegram')
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
let preorders = loadData('preorders', [])
let writeoffs = loadData('writeoffs', [])

// === Agent system data ===
let agents = loadData('agents', [])
let clients = loadData('clients', [])
let clicks = loadData('clicks', [])
let notifications = loadData('notifications', [])
let tasks = loadData('tasks', [])
let settings = loadData('settings', { retail_reward: 7500, wholesale_reward: 2500 })

function saveAll() {
  saveData('products', products)
  saveData('orders', orders)
  saveData('stock', stock)
  saveData('shipments', shipments)
  saveData('preorders', preorders)
  saveData('writeoffs', writeoffs)
  saveData('nextId', nextId)
  saveData('shipmentCounter', shipmentCounter)
  saveData('agents', agents)
  saveData('clients', clients)
  saveData('clicks', clicks)
  saveData('notifications', notifications)
  saveData('tasks', tasks)
  saveData('settings', settings)
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
  writeoffs.forEach(w => {
    // New multi-item format
    if (w.items && Array.isArray(w.items)) {
      w.items.forEach(item => {
        if (item.colors && typeof item.colors === 'object') {
          Object.entries(item.colors).forEach(([color, qty]) => {
            const key = item.product_id + ':' + color
            available[key] = (available[key] || 0) - (qty || 0)
          })
        }
      })
    }
    // Old single-item format with colors object
    if (w.colors && typeof w.colors === 'object') {
      Object.entries(w.colors).forEach(([color, qty]) => {
        const key = w.product_id + ':' + color
        available[key] = (available[key] || 0) - (qty || 0)
      })
    }
    // Old format with single color/qty
    if (w.color) {
      const key = w.product_id + ':' + w.color
      available[key] = (available[key] || 0) - (w.qty || 0)
    }
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
  // Привязка агента: ТОЛЬКО если клиент пришёл по реферальной ссылке (ref из cookie).
  // Без ссылки (заход на www.ouda.ru напрямую) — заказ компании (без агента).
  const normPhone = (t) => String(t || '').replace(/[^\d]/g, '').replace(/^8(\d{10})$/, '7$1')
  const phone = normPhone(req.body.phone)
  let agent = null
  if (req.body.agent_ref) {
    agent = agents.find(a => a.code === req.body.agent_ref && a.status !== 'blocked')
  }
  if (agent) {
    o.agent_id = agent.id
    o.agent_ref = agent.code
    // Авто-карточка клиента в CRM (без дублей по телефону)
    let client = clients.find(c => c.agent_id === agent.id && normPhone(c.phone) === phone)
    if (!client) {
      client = {
        id: nextId++,
        agent_id: agent.id,
        name: req.body.name || '',
        phone: req.body.phone || '',
        city: req.body.city || '',
        source: 'site',
        status: 'new',
        note: 'Заказ с сайта',
        items: (o.items || []).map(i => ({ product_id: i.product_id || null, name: i.name || '', color: i.color || '', qty: Number(i.qty) || 0 })),
        order_id: o.id,
        created_at: new Date().toISOString(),
      }
      clients.unshift(client)
    } else {
      client.name = req.body.name || client.name
      client.phone = req.body.phone || client.phone
      client.city = req.body.city || client.city
      client.status = 'order'
      client.items = (o.items || []).map(i => ({ product_id: i.product_id || null, name: i.name || '', color: i.color || '', qty: Number(i.qty) || 0 }))
      client.order_id = o.id
    }
    // Уведомление агенту
    const totalQty = (o.items || []).reduce((s, i) => s + (i.qty || 0), 0)
    const type = totalQty >= 3 ? 'опт' : 'розница'
    const reward = totalQty >= 3 ? (settings.wholesale_reward || 2500) : (settings.retail_reward || 7500)
    notifyAgent(agent, `Новый заказ ${formatOrderNumber(o)} | ${o.name || ''} | ${o.phone || ''} | ${(o.total || 0).toLocaleString('ru-RU')} ₽ | ${type} (+${reward} ₽)`)
  }
  orders.unshift(o)
  saveAll()
  res.json(o)
})
app.patch('/api/orders/:id', (req, res) => {
  const o = orders.find(o => o.id == req.params.id)
  if (!o) return res.status(404).json({ error: 'not found' })
  const prevStatus = o.status
  Object.assign(o, req.body)
  // Заработок агента: при статусе «отгружен» — фактический (уведомление)
  if (o.agent_id && req.body.status && req.body.status !== prevStatus) {
    const agent = agents.find(a => a.id === o.agent_id)
    if (agent && req.body.status === 'shipped') {
      const totalQty = (o.items || []).reduce((s, i) => s + (i.qty || 0), 0)
      const reward = totalQty >= 3 ? (settings.wholesale_reward || 2500) : (settings.retail_reward || 7500)
      notifyAgent(agent, `Заказ отгружен | ${o.name || ''} | +${reward} ₽ фактический заработок`)
    } else if (agent && req.body.status === 'cancelled') {
      notifyAgent(agent, `Заказ отменён | ${o.name || ''} | ${(o.total || 0).toLocaleString('ru-RU')} ₽`)
    } else if (agent && req.body.status === 'paid') {
      notifyAgent(agent, `Заказ оплачен | ${o.name || ''} | ${(o.total || 0).toLocaleString('ru-RU')} ₽`)
    }
  }
  // Заказ завершён — клиент в CRM агента автоматически становится «Продано»
  if (o.status === 'done') {
    const cl = clients.find(x => x.order_id == o.id)
    if (cl && cl.status !== 'sold') { cl.status = 'sold'; cl.save_needed = true }
  }
  saveAll()
  res.json(o || { error: 'not found' })
})

function formatOrderNumber(o) {
  if (o.number) return o.number
  return 'OUDA-' + String(o.id).padStart(3, '0')
}

// === Stock ===
app.get('/api/stock', (req, res) => res.json(stock))
app.post('/api/stock', (req, res) => {
  const s = { id: nextId++, ...req.body }
  stock.unshift(s)
  saveAll()
  res.json(s)
})
app.delete('/api/stock/:id', (req, res) => {
  stock = stock.filter(s => s.id != req.params.id)
  saveAll()
  res.json({ ok: true })
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

// === Delivery calculation via TK KIT ===
const KIT_TOKEN = 'BxN1JrdgdTqIiWj8BIio4UR9lIRxJkrr'
const KIT_API = 'https://capi.tk-kit.com'

app.post('/api/search-city', async (req, res) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ error: 'no name' })
  try {
    const response = await fetch(KIT_API + '/1.0/tdd/search/by-name', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + KIT_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: name })
    })
    const data = await response.json()
    if (Array.isArray(data) && data.length > 0) {
      res.json({ code: data[0].code, name: data[0].name })
    } else {
      res.json({ error: 'not found' })
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/search-terminals', async (req, res) => {
  const { city_code } = req.body
  try {
    const response = await fetch(KIT_API + '/1.1/geography/address/get-list', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + KIT_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ city_code: city_code })
    })
    const data = await response.json()
    res.json(Array.isArray(data) ? data : [])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/calculate-delivery', async (req, res) => {
  const { city_code, items } = req.body
  if (!items || items.length === 0) return res.status(400).json({ error: 'no items' })

  const places = items.map(item => ({
    count_place: item.qty || 1,
    weight: Number(item.weight) || 1,
    length: Number(item.length) || 10,
    width: Number(item.width) || 10,
    height: Number(item.height) || 10,
    cargo_type: 'Z01'
  }))

  const totalPrice = items.reduce((s, i) => s + (Number(i.price) || 0) * (i.qty || 1), 0)

  try {
    const response = await fetch(KIT_API + '/2.0/order/calculate', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + KIT_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        city_pickup_code: '770000000000',
        city_delivery_code: city_code,
        declared_price: totalPrice,
        profile_id: 426320,
        places: places
      })
    })
    const data = await response.json()
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// === Writeoffs ===
app.get('/api/writeoffs', (req, res) => res.json(writeoffs))
app.post('/api/writeoffs', (req, res) => {
  const w = { id: nextId++, ...req.body, created_at: new Date().toISOString() }
  writeoffs.unshift(w)
  saveAll()
  res.json(w)
})
app.delete('/api/writeoffs/:id', (req, res) => {
  writeoffs = writeoffs.filter(w => w.id != req.params.id)
  saveAll()
  res.json({ ok: true })
})

// === Preorders ===
app.get('/api/preorders', (req, res) => res.json(preorders))
app.post('/api/preorders', (req, res) => {
  const p = { id: nextId++, ...req.body, created_at: new Date().toISOString() }
  preorders.unshift(p)
  saveAll()
  res.json(p)
})
app.delete('/api/preorders/:id', (req, res) => {
  preorders = preorders.filter(p => p.id != req.params.id)
  saveAll()
  res.json({ ok: true })
})

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

// === Agent system ===

// Вспомогательные
function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let s = ''
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}
function translit(name) {
  const map = {
    а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
    А:'a',Б:'b',В:'v',Г:'g',Д:'d',Е:'e',Ё:'e',Ж:'zh',З:'z',И:'i',Й:'y',К:'k',Л:'l',М:'m',Н:'n',О:'o',П:'p',Р:'r',С:'s',Т:'t',У:'u',Ф:'f',Х:'h',Ц:'ts',Ч:'ch',Ш:'sh',Щ:'sch',Ъ:'',Ы:'y',Ь:'',Э:'e',Ю:'yu',Я:'ya'
  }
  return String(name || '').split('').map(c => map[c] || (/[a-z0-9]/i.test(c) ? c.toLowerCase() : '')).join('').replace(/[^a-z0-9]/g, '')
}
function genCode(seed) {
  // Короткий код: из имени (транслит) или случайный, всегда уникальный
  let base = translit(seed || '').slice(0, 12)
  if (!base) {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
    for (let i = 0; i < 6; i++) base += chars[Math.floor(Math.random() * chars.length)]
  }
  let code = base
  let n = 2
  while (agents.some(a => a.code === code)) { code = base + n; n++ }
  return code
}
function genTgCode() { return String(Math.floor(100000 + Math.random() * 900000)) }

function rewardForOrder(o) {
  const totalQty = (o.items || []).reduce((s, i) => s + (i.qty || 0), 0)
  return {
    qty: totalQty,
    type: totalQty >= 3 ? 'wholesale' : 'retail',
    amount: totalQty >= 3 ? (settings.wholesale_reward || 2500) : (settings.retail_reward || 7500),
  }
}

const ADMIN_TG_CHAT = 5368408796
function notifyOwner(text) {
  if (ADMIN_TG_CHAT) sendTelegramTo(ADMIN_TG_CHAT, text).catch(() => {})
}
function createOrderFromClient(agent, client, prepaid) {
  const items = (client.items || []).map(it => {
    const pr = products.find(x => String(x.id) === String(it.product_id))
    return { product_id: it.product_id, name: it.name || (pr ? pr.name : ''), color: it.color || '', qty: Number(it.qty) || 0, price: pr ? (pr.price || 0) : 0 }
  })
  const total = items.reduce((sum, i) => sum + (i.price || 0) * (i.qty || 0), 0)
  const o = {
    id: nextId++,
    agent_id: agent.id,
    agent_ref: agent.code || '',
    name: client.name || '',
    phone: client.phone || '',
    city: client.city || '',
    transport: client.transport || '',
    pickup_date: client.pickup_date || '',
    items,
    total,
    prepaid: Number(prepaid) || 0,
    status: 'prepaid',
    source: 'agent_crm',
    created_at: new Date().toISOString(),
  }
  orders.unshift(o)
  return o
}

function notifyAgent(agent, text) {
  if (!agent) return
  const n = { id: nextId++, agent_id: agent.id, text, read: false, created_at: new Date().toISOString() }
  notifications.unshift(n)
  saveAll()
  if (agent.tg_chat_id) {
    sendTelegramTo(agent.tg_chat_id, text).then(ok => {
      if (ok) { n.tg_sent = true; saveAll() }
    })
  }
  return n
}

function publicAgent(code) {
  const a = agents.find(x => x.code === code && x.status !== 'blocked')
  if (!a) return null
  return {
    code: a.code,
    name: a.name,
    max_link: a.max_link || '',
    tg_link: a.tg_link || '',
    wa_link: a.wa_link || '',
    phone: a.phone || '',
  }
}

// Публичный: данные агента для подмены контактов
app.get('/api/agent-info', (req, res) => {
  const info = publicAgent(req.query.ref || '')
  res.json(info)
})

// Публичный: клик по контакту (для статистики агента)
app.post('/api/clicks', (req, res) => {
  const { ref, type } = req.body
  const agent = agents.find(a => a.code === ref && a.status !== 'blocked')
  if (!agent) return res.status(404).json({ error: 'agent not found' })
  clicks.push({ id: nextId++, agent_id: agent.id, type: type || 'contact', created_at: new Date().toISOString() })
  saveAll()
  res.json({ ok: true })
})

// === Агенты: админ/менеджер ===
function authRole(req, res, next) {
  const role = req.headers['x-admin-role']
  if (!role || (role !== 'admin' && role !== 'manager')) return res.status(401).json({ error: 'auth required' })
  req.role = role
  next()
}

app.get('/api/agents', authRole, (req, res) => {
  const list = agents.map(a => {
    const agentOrders = orders.filter(o => o.agent_id === a.id)
    const agentClicks = clicks.filter(c => c.agent_id === a.id)
    let potential = 0, actual = 0
    agentOrders.forEach(o => {
      const r = rewardForOrder(o)
      potential += r.amount
      if (o.status === 'shipped') actual += r.amount
    })
    return {
      ...a,
      password: undefined,
      stats: {
        clicks: agentClicks.length,
        orders: agentOrders.length,
        potential,
        actual,
        clients: clients.filter(c => c.agent_id === a.id).length,
      },
    }
  })
  res.json(list)
})

app.post('/api/agents', authRole, (req, res) => {
  const b = req.body
  let code = String(b.code || '').trim()
  if (!code) code = genCode(b.name || '')
  else if (agents.some(x => x.code === code)) return res.status(400).json({ error: 'Такой код ссылки уже занят другим агентом' })
  let login = (b.login || '').toLowerCase().replace(/[^a-z0-9]/g, '') || code
  let n = 2
  const baseLogin = login
  while (agents.some(a => a.login === login)) { login = baseLogin + n; n++ }
  const agent = {
    id: nextId++,
    name: b.name || '',
    code,
    login: login || genCode('agent'),
    password: genPassword(),
    max_link: b.max_link || '',
    tg_link: b.tg_link || '',
    wa_link: b.wa_link || '',
    phone: b.phone || '',
    status: 'active',
    tg_chat_id: null,
    created_at: new Date().toISOString(),
  }
  agents.push(agent)
  saveAll()
  sendTelegram('Новый агент: ' + agent.name + ' | ссылка: https://ouda.ru/?ref=' + encodeURIComponent(agent.code) + ' | логин: ' + agent.login)
  res.json({ ...agent, password: undefined, password_plain: agent.password })
})

app.patch('/api/agents/:id', authRole, (req, res) => {
  const a = agents.find(x => x.id == req.params.id)
  if (!a) return res.status(404).json({ error: 'not found' })
  const { name, code, max_link, tg_link, wa_link, phone, status } = req.body
  if (name !== undefined) a.name = name
  if (code !== undefined && code !== a.code) {
    const newCode = String(code || '').trim() || genCode(name || '')
    if (agents.some(x => x.id !== a.id && x.code === newCode)) return res.status(400).json({ error: 'Такой код ссылки уже занят другим агентом' })
    a.code = newCode
  }
  if (max_link !== undefined) a.max_link = max_link
  if (tg_link !== undefined) a.tg_link = tg_link
  if (wa_link !== undefined) a.wa_link = wa_link
  if (phone !== undefined) a.phone = phone
  if (status !== undefined) a.status = status
  saveAll()
  res.json({ ...a, password: undefined })
})


app.delete('/api/agents/:id', authRole, (req, res) => {
  const before = agents.length
  agents = agents.filter(x => x.id != req.params.id)
  clients = clients.filter(c => c.agent_id != req.params.id)
  if (agents.length === before) return res.status(404).json({ error: 'not found' })
  saveAll()
  res.json({ ok: true })
})

app.post('/api/agents/:id/reset-password', authRole, (req, res) => {
  const a = agents.find(x => x.id == req.params.id)
  if (!a) return res.status(404).json({ error: 'not found' })
  a.password = genPassword()
  saveAll()
  res.json({ password_plain: a.password })
})

// === Кабинет агента ===
function authAgent(req, res, next) {
  const token = req.headers['x-agent-token']
  const a = agents.find(x => x.token === token && x.status !== 'blocked')
  if (!a) return res.status(401).json({ error: 'auth required' })
  req.agent = a
  next()
}

app.post('/api/agent/login', (req, res) => {
  const { login, password } = req.body
  const a = agents.find(x => x.login === (login || '').toLowerCase().trim() && x.password === password)
  if (!a) return res.status(401).json({ error: 'bad credentials' })
  if (a.status === 'blocked') return res.status(403).json({ error: 'blocked' })
  if (!a.token) { a.token = genPassword() + genPassword(); saveAll() }
  res.json({ token: a.token, agent: { id: a.id, name: a.name, code: a.code, login: a.login } })
})

app.get('/api/agent/me', authAgent, (req, res) => {
  const a = req.agent
  const agentOrders = orders.filter(o => o.agent_id === a.id)
  const agentClicks = clicks.filter(c => c.agent_id === a.id)
  let potential = 0, actual = 0
  const orderStats = { total: agentOrders.length, paid: 0, shipped: 0, cancelled: 0 }
  agentOrders.forEach(o => {
    const r = rewardForOrder(o)
    potential += r.amount
    if (o.status === 'shipped') { actual += r.amount; orderStats.shipped++ }
    if (o.status === 'paid') orderStats.paid++
    if (o.status === 'cancelled') orderStats.cancelled++
  })
  res.json({
    agent: { id: a.id, name: a.name, code: a.code, login: a.login, phone: a.phone || '', max_link: a.max_link || '', tg_link: a.tg_link || '', wa_link: a.wa_link || '' },
    link: 'https://ouda.ru/?ref=' + encodeURIComponent(a.code),
    stats: {
      clicks: agentClicks.length,
      potential,
      actual,
      orders: orderStats,
      clients: clients.filter(c => c.agent_id === a.id).length,
    },
    settings: { retail_reward: settings.retail_reward || 7500, wholesale_reward: settings.wholesale_reward || 2500 },
    tg_connected: !!a.tg_chat_id,
  })
})

app.get('/api/agent/orders', authAgent, (req, res) => {
  const list = orders.filter(o => o.agent_id === req.agent.id).map(o => ({ ...o, reward: rewardForOrder(o) }))
  res.json(list)
})

app.get('/api/agent/clients', authAgent, (req, res) => res.json(clients.filter(c => c.agent_id === req.agent.id)))

app.post('/api/agent/clients', authAgent, (req, res) => {
  const b = req.body
  const c = {
    id: nextId++,
    agent_id: req.agent.id,
    name: b.name || '',
    phone: b.phone || '',
    city: b.city || '',
    source: b.source || 'manual',
    status: b.status || 'new',
    note: b.note || '',
    prepaid_amount: Number(b.prepaid_amount) || 0,
    items: Array.isArray(b.items) ? b.items.map(i => ({ product_id: i.product_id || null, name: i.name || '', color: i.color || '', qty: Number(i.qty) || 0 })) : [],
    created_at: new Date().toISOString(),
  }
  clients.unshift(c)
  // Предоплата внесена — сразу создаём заказ владельцу
  if (c.status === 'prepaid' && c.prepaid_amount > 0) {
    const o = createOrderFromClient(req.agent, c, c.prepaid_amount)
    c.order_id = o.id
    notifyOwner(`Новый заказ от агента ${req.agent.name} | ${c.name || ''} | ${c.phone || ''} | Предоплата: ${c.prepaid_amount.toLocaleString('ru-RU')} ₽`)
  }
  saveAll()
  res.json(c)
})

app.patch('/api/agent/clients/:id', authAgent, (req, res) => {
  const c = clients.find(x => x.id == req.params.id && x.agent_id === req.agent.id)
  if (!c) return res.status(404).json({ error: 'not found' })
  Object.assign(c, req.body)
  // Предоплата внесена — заказ создаётся/обновляется у владельца
  if (c.status === 'prepaid' && c.prepaid_amount > 0) {
    let o = c.order_id ? orders.find(x => x.id == c.order_id) : null
    if (o) {
      o.prepaid = Number(c.prepaid_amount) || o.prepaid || 0
      o.agent_id = req.agent.id
      o.agent_ref = req.agent.code || o.agent_ref
      o.name = c.name || o.name
      o.phone = c.phone || o.phone
      o.transport = c.transport || o.transport
      o.pickup_date = c.pickup_date || o.pickup_date
      if (['new', 'accepted'].includes(o.status)) o.status = 'prepaid'
    } else {
      o = createOrderFromClient(req.agent, c, c.prepaid_amount)
      c.order_id = o.id
    }
    notifyOwner(`Предоплата от клиента агента ${req.agent.name} | ${c.name || ''} | ${c.phone || ''} | ${c.prepaid_amount.toLocaleString('ru-RU')} ₽`)
  }
  saveAll()
  res.json(c)
})

app.delete('/api/agent/clients/:id', authAgent, (req, res) => {
  clients = clients.filter(x => !(x.id == req.params.id && x.agent_id === req.agent.id))
  saveAll()
  res.json({ ok: true })
})

// Задачи/напоминания
app.get('/api/agent/tasks', authAgent, (req, res) => res.json(tasks.filter(t => t.agent_id === req.agent.id)))
app.post('/api/agent/tasks', authAgent, (req, res) => {
  const b = req.body
  const t = {
    id: nextId++,
    agent_id: req.agent.id,
    client_id: b.client_id || null,
    text: b.text || '',
    due_date: b.due_date || '',
    done: false,
    created_at: new Date().toISOString(),
  }
  tasks.unshift(t)
  saveAll()
  res.json(t)
})
app.patch('/api/agent/tasks/:id', authAgent, (req, res) => {
  const t = tasks.find(x => x.id == req.params.id && x.agent_id === req.agent.id)
  if (!t) return res.status(404).json({ error: 'not found' })
  Object.assign(t, req.body)
  saveAll()
  res.json(t)
})
app.delete('/api/agent/tasks/:id', authAgent, (req, res) => {
  tasks = tasks.filter(x => !(x.id == req.params.id && x.agent_id === req.agent.id))
  saveAll()
  res.json({ ok: true })
})

// Уведомления агента
app.get('/api/agent/notifications', authAgent, (req, res) => res.json(notifications.filter(n => n.agent_id === req.agent.id)))
app.post('/api/agent/notifications/read', authAgent, (req, res) => {
  notifications.forEach(n => { if (n.agent_id === req.agent.id) n.read = true })
  saveAll()
  res.json({ ok: true })
})

// Привязка Telegram: кабинет запрашивает код
app.post('/api/agent/tg-code', authAgent, (req, res) => {
  req.agent.tg_code = genTgCode()
  req.agent.tg_code_expires = Date.now() + 10 * 60 * 1000 // 10 минут
  saveAll()
  res.json({ code: req.agent.tg_code })
})

// MAX/админ: добавить клиента вручную и привязать к агенту
app.post('/api/agents/:id/clients', authRole, (req, res) => {
  const a = agents.find(x => x.id == req.params.id)
  if (!a) return res.status(404).json({ error: 'agent not found' })
  const b = req.body
  const c = {
    id: nextId++,
    agent_id: a.id,
    name: b.name || '',
    phone: b.phone || '',
    city: b.city || '',
    source: b.source || 'manual',
    status: b.status || 'new',
    note: b.note || '',
    created_at: new Date().toISOString(),
  }
  clients.unshift(c)
  saveAll()
  notifyAgent(a, 'Новый клиент (добавил менеджер) | ' + (c.name || '') + ' | ' + (c.phone || ''))
  res.json(c)
})


// Список всех клиентов CRM (админ/менеджер)
app.get('/api/clients', authRole, (req, res) => {
  const list = clients.map(c => ({ ...c, agent_name: (agents.find(a => a.id === c.agent_id) || {}).name || '—' }))
  res.json(list)
})

// Настройки ставок (только admin)
app.get('/api/settings', authRole, (req, res) => {
  if (req.role !== 'admin') return res.status(403).json({ error: 'admin only' })
  res.json(settings)
})
app.patch('/api/settings', authRole, (req, res) => {
  if (req.role !== 'admin') return res.status(403).json({ error: 'admin only' })
  if (req.body.retail_reward !== undefined) settings.retail_reward = Number(req.body.retail_reward) || 0
  if (req.body.wholesale_reward !== undefined) settings.wholesale_reward = Number(req.body.wholesale_reward) || 0
  saveAll()
  res.json(settings)
})

// === Telegram webhook: привязка агентов (/start <код>) ===
app.post('/tg-hook', (req, res) => {
  res.json({ ok: true })
  try {
    const u = req.body || {}
    const msg = u.message || u.edited_message
    if (!msg || !msg.text || !msg.chat) return
    const text = msg.text.trim()
    if (text.startsWith('/start')) {
      const code = text.split(/\s+/)[1] || ''
      if (code) {
        const a = agents.find(x => x.tg_code === code && x.tg_code_expires && Date.now() < x.tg_code_expires)
        if (a) {
          a.tg_chat_id = msg.chat.id
          a.tg_code = null
          a.tg_code_expires = null
          saveAll()
          sendTelegramTo(a.tg_chat_id, 'Подключено! Теперь вы будете получать уведомления о заказах здесь.')
        } else {
          sendTelegramTo(msg.chat.id, 'Код не найден или истёк. Запросите новый код в кабинете агента.')
        }
      }
    }
  } catch (e) {
    console.error('TG webhook error:', e.message)
  }
})

// Установка webhook при старте + повтор каждые 2 минуты, пока не установится
let webhookOk = false
async function ensureWebhook() {
  if (webhookOk) return
  const ok = await setWebhook('https://ouda.ru/tg-hook')
  if (ok) { webhookOk = true; console.log('Telegram webhook set: OK') }
  else console.log('Telegram webhook set: FAIL (повтор через 2 мин)')
}
//setTimeout(ensureWebhook, 3000) // отключено: входящие идут через NL-мост (bridge.js)
//setInterval(ensureWebhook, 120000) // отключено: входящие идут через NL-мост (bridge.js)
