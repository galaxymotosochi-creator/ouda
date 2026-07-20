const express = require('express')
const cors = require('cors')
const app = express()

app.use(cors())
app.use(express.json())

let products = [
  { id: 1, name: 'OUDA Street 50', price: 79900, image: '/placeholder.svg', power: '3.7 кВт', fuel: 'Бензин АИ-92', cooling: 'Воздушное', max_speed: '65 км/ч', wheels: '10"', description: '', colors: [
      { name: 'Чёрный', hex: '#1a1a1a' }, { name: 'Белый', hex: '#f0f0f0' }, { name: 'Красный', hex: '#c23a2b' },
    ]},
  { id: 2, name: 'OUDA Sport 125', price: 129900, image: '/placeholder.svg', power: '8.2 кВт', fuel: 'Бензин АИ-95', cooling: 'Жидкостное', max_speed: '95 км/ч', wheels: '12"', description: '', colors: [
      { name: 'Красный', hex: '#c23a2b' }, { name: 'Синий', hex: '#1a3a6b' }, { name: 'Чёрный матовый', hex: '#2a2a2a' },
    ]},
  { id: 3, name: 'OUDA Electric', price: 99900, image: '/placeholder.svg', power: '2000 Вт', fuel: 'Электро', cooling: 'Воздушное', max_speed: '75 км/ч', wheels: '10"', description: '', colors: [
      { name: 'Белый', hex: '#f0f0f0' }, { name: 'Серый матовый', hex: '#6a6a6a' }, { name: 'Синий матовый', hex: '#1a2a4b' }, { name: 'Хамелеон', hex: 'chameleon' },
    ]},
]
let orders = []
let stock = [
  { id: 1, product_id: 1, product_name: 'OUDA Street 50', date: '2026-07-15', status: 'received', expected_date: null, colors: { 'Чёрный': 5, 'Белый': 3, 'Красный': 2 } },
  { id: 2, product_id: 3, product_name: 'OUDA Electric', date: '2026-07-20', status: 'transit', expected_date: '2026-08-05', colors: { 'Белый': 10, 'Хамелеон': 5 } },
  { id: 3, product_id: 1, product_name: 'OUDA Street 50', date: '2026-07-20', status: 'transit', expected_date: '2026-08-10', colors: { 'Чёрный': 10, 'Красный': 5 } },
]
let shipments = []
let nextId = 100
let shipmentCounter = 0

// Compute available stock per product:color
function computeAvailableStock() {
  const available = {}
  // Add received stock
  stock.filter(s => s.status === 'received').forEach(s => {
    Object.entries(s.colors || {}).forEach(([color, qty]) => {
      const key = s.product_id + ':' + color
      available[key] = (available[key] || 0) + qty
    })
  })
  // Subtract non-cancelled shipments
  shipments.filter(s => s.status !== 'отменено').forEach(s => {
    (s.items || []).forEach(item => {
      const key = item.product_id + ':' + item.color
      available[key] = (available[key] || 0) - item.qty
    })
  })
  return available
}

// Enriched products with stock info
function getEnrichedProducts() {
  const avail = computeAvailableStock()
  return products.map(p => {
    const productStock = stock.filter(s => s.product_id === p.id)
    const received = productStock.some(s => s.status === 'received')
    const transit = productStock.filter(s => s.status === 'transit')
    const totalTransit = transit.reduce((sum, s) => sum + Object.values(s.colors || {}).reduce((a, b) => a + b, 0), 0)
    const earliestTransit = transit.sort((a, b) => new Date(a.expected_date) - new Date(b.expected_date))[0]

    const colorsAvailable = {}
    ;(p.colors || []).forEach(c => {
      const key = p.id + ':' + c.name
      colorsAvailable[c.name] = avail[key] || 0
    })

    return {
      ...p,
      in_stock: received,
      expected_qty: totalTransit || null,
      expected_date: earliestTransit?.expected_date || null,
      available_colors: colorsAvailable,
    }
  })
}

// Products
app.get('/api/products', (req, res) => res.json(getEnrichedProducts()))
app.post('/api/products', (req, res) => {
  const p = { id: nextId++, ...req.body, colors: [] }
  products.push(p)
  res.json(p)
})
app.delete('/api/products/:id', (req, res) => {
  products = products.filter(p => p.id != req.params.id)
  res.json({ ok: true })
})

// Orders
app.get('/api/orders', (req, res) => res.json(orders))
app.post('/api/orders', (req, res) => {
  const o = { id: nextId++, ...req.body, status: 'new', created_at: new Date().toISOString() }
  orders.unshift(o)
  res.json(o)
})
app.patch('/api/orders/:id', (req, res) => {
  const o = orders.find(o => o.id == req.params.id)
  if (o) Object.assign(o, req.body)
  res.json(o || { error: 'not found' })
})

// Stock (поступления)
app.get('/api/stock', (req, res) => res.json(stock))
app.post('/api/stock', (req, res) => {
  const s = { id: nextId++, ...req.body }
  stock.push(s)
  res.json(s)
})

// === SHIPMENTS (отгрузки) ===

app.get('/api/shipments', (req, res) => {
  res.json(shipments)
})

app.get('/api/shipments/:id', (req, res) => {
  const s = shipments.find(s => s.id == req.params.id)
  if (!s) return res.status(404).json({ error: 'not found' })
  res.json(s)
})

app.post('/api/shipments', (req, res) => {
  shipmentCounter++
  const number = 'OUDA-' + String(shipmentCounter).padStart(3, '0')
  const s = {
    id: nextId++,
    number,
    created_at: new Date().toISOString(),
    status: 'оформлено',
    prepaid: 0,
    paid: 0,
    ...req.body,
  }
  // Auto-fill client from order if linked
  if (s.order_id) {
    const order = orders.find(o => o.id == s.order_id)
    if (order && !s.client) {
      s.client = { name: order.name, phone: order.phone, city: order.city || '' }
    }
  }
  shipments.push(s)
  res.json(s)
})

app.patch('/api/shipments/:id', (req, res) => {
  const s = shipments.find(s => s.id == req.params.id)
  if (!s) return res.status(404).json({ error: 'not found' })
  Object.assign(s, req.body)
  res.json(s)
})

// Available stock endpoint
app.get('/api/stock/available', (req, res) => {
  res.json(computeAvailableStock())
})

const PORT = process.env.PORT || 3002
app.listen(PORT, '127.0.0.1', () => console.log('OUDA API on port', PORT))
