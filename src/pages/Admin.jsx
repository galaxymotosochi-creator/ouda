import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../i18n'
import { PRESET_COLORS, getColorHex } from '../colors'

const API = import.meta.env.VITE_API_URL || ''
const LS_ORDERS = 'ouda_orders'
const LS_PRODUCTS = 'ouda_products'
const LS_STOCK = 'ouda_stock'
const LS_SHIPMENTS = 'ouda_shipments'

function getLocal(key) { try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] } }
function setLocal(key, data) { localStorage.setItem(key, JSON.stringify(data)) }

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatShortDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function Admin() {
  const { t, lang, setLang, translateColor } = useLang()
  const navigate = useNavigate()
  const role = sessionStorage.getItem('ouda_admin') || ''
  const isSupplier = role === 'supplier'
  const isManager = role === 'manager'
  const defaultTab = isSupplier ? 'stock' : (isManager ? 'agents' : 'orders')
  const [tab, setTab] = useState(defaultTab)
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [stock, setStock] = useState([])
  const [shipments, setShipments] = useState([])
  const [preorders, setPreorders] = useState([])
  const [writeoffs, setWriteoffs] = useState([])
  const [agents, setAgents] = useState([])
  const [agentClients, setAgentClients] = useState([])
  const [writeoffForm, setWriteoffForm] = useState({ items: [{ product_id: '', product_name: '', colors: {} }], reason: 'sale', comment: '', client_name: '', client_phone: '+7', price: '' })
  const [deleteStockItem, setDeleteStockItem] = useState(null)

  // Create shipment modal
  const [showShipModal, setShowShipModal] = useState(false)
  const [shipOrder, setShipOrder] = useState(null)
  const [shipOrderNum, setShipOrderNum] = useState(0)
  const [shipForm, setShipForm] = useState({ client: { name: '', phone: '', city: '', transport: '' }, items: [], prepaid: 0, paid: 0, date: new Date().toISOString().slice(0, 10) })
  const [shipShipment, setShipShipment] = useState(null)
  const [shipPayAmount, setShipPayAmount] = useState('')
  const [showShipPayModal, setShowShipPayModal] = useState(false)

  // Invoice modal
  const [invoiceShip, setInvoiceShip] = useState(null)

  // New product form
  const [newProduct, setNewProduct] = useState({
    name_ru: '', name_zh: '', price: '', wholesale_price: '', power: '', fuel: '', cooling: '', max_speed: '', wheels: '', description: '', images: [], weight: '', length: '', width: '', height: ''
  })
  const [photos, setPhotos] = useState([]) // file previews
  const [uploading, setUploading] = useState(false)
  // Edit product modal
  const [editingProduct, setEditingProduct] = useState(null)
  const [editForm, setEditForm] = useState({ name_ru: '', name_zh: '', price: '', wholesale_price: '', power: '', fuel: '', cooling: '', max_speed: '', wheels: '', description: '', weight: '', length: '', width: '', height: '' })
  const [editPhotos, setEditPhotos] = useState([])

  const openEditProduct = (p) => {
    setEditForm({
      name_ru: p.name_ru || p.name || '',
      name_zh: p.name_zh || '',
      price: p.price || '',
      wholesale_price: p.wholesale_price || '',
      weight: p.weight || '',
      length: p.length || '',
      width: p.width || '',
      height: p.height || '',
      power: p.power || '',
      fuel: p.fuel || '',
      cooling: p.cooling || '',
      max_speed: p.max_speed || '',
      wheels: p.wheels || '',
      description: p.description || '',
      type: p.type || (p.assembly_price === 12000 ? 'enduro' : 'scooter'),
    })
    setEditPhotos((p.images || []).map(url => ({ file: null, url })))
    setEditingProduct(p)
  }

  const closeEditProduct = () => { setEditingProduct(null); setEditPhotos([]) }

  const handleEditPhotos = (e) => {
    const files = Array.from(e.target.files)
    const total = editPhotos.length + files.length
    if (total > 7) { alert(t('maxPhotos')); return }
    const newPhotos = files.map(f => ({ file: f, url: URL.createObjectURL(f) }))
    setEditPhotos(prev => [...prev, ...newPhotos])
    e.target.value = ''
  }

  const removeEditPhoto = (idx) => {
    setEditPhotos(prev => { URL.revokeObjectURL(prev[idx].url); return prev.filter((_, i) => i !== idx) })
  }

  const updateProduct = () => {
    try {
      if (!editingProduct) { alert('Ошибка: товар не выбран'); return }

      const uploadAndSave = (finalImages) => {
        const updated = {
          name_ru: editForm.name_ru,
          name_zh: editForm.name_zh,
          price: Number(editForm.price) || 0,
          wholesale_price: Number(editForm.wholesale_price) || 0,
          weight: Number(editForm.weight) || 0,
          length: Number(editForm.length) || 0,
          width: Number(editForm.width) || 0,
          height: Number(editForm.height) || 0,
          power: editForm.power,
          fuel: editForm.fuel,
          cooling: editForm.cooling,
          max_speed: editForm.max_speed,
          wheels: editForm.wheels,
          description: editForm.description,
          type: editForm.type,
          assembly_price: editForm.type === 'enduro' ? 12000 : 7000,
          images: finalImages,
          image: finalImages[0] || '',
          name: lang === 'zh' ? (editForm.name_zh || editForm.name_ru) : (editForm.name_ru || editForm.name_zh),
        }

        const list = getLocal(LS_PRODUCTS).map(p => p.id === editingProduct.id ? { ...p, ...updated } : p)
        setLocal(LS_PRODUCTS, list)
        setProducts(list)
        setEditingProduct(null)
        setEditPhotos([])

        fetch(`${API}/api/products/${editingProduct.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        }).then(r => { if (r.ok) setTimeout(loadData, 300) }).catch(() => {})
      }

      // Есть новые фото? Загружаем
      const newFiles = editPhotos.filter(p => p.file)
      if (newFiles.length > 0) {
        const formData = new FormData()
        newFiles.forEach(p => formData.append('photos', p.file))
        fetch(`${API}/api/upload`, { method: 'POST', body: formData })
          .then(r => r.json())
          .then(data => {
            const newUrls = data.urls || []
            let idx = 0
            const allImages = editPhotos.map(p => p.file ? (newUrls[idx++] || '') : p.url).filter(Boolean)
            uploadAndSave(allImages)
          })
          .catch(() => {
            // Если загрузка не удалась — сохраняем без новых фото
            const allImages = editPhotos.filter(p => !p.file).map(p => p.url)
            uploadAndSave(allImages)
          })
      } else {
        const allImages = editPhotos.map(p => p.url).filter(Boolean)
        uploadAndSave(allImages)
      }

    } catch (e) {
      alert('Ошибка при сохранении: ' + e.message)
    }
  }

  // Stock form
  const [stockForm, setStockForm] = useState({ product_id: '', selectedColors: {}, status: 'received' })  // { 'Красный': 5, 'Чёрный': 3 }
  const [inventory, setInventory] = useState([])

  useEffect(() => {
    if (!sessionStorage.getItem('ouda_admin')) { navigate('/login'); return }
    loadData()
    const timer = setInterval(loadData, 5000)
    return () => clearInterval(timer)
  }, [])

  const loadData = () => {
    // Загружаем с сервера, сохраняем в localStorage на будущее
    fetch(`${API}/api/products`).then(r => { if (r.ok) return r.json(); throw 'fail' })
      .then(data => { setLocal(LS_PRODUCTS, data); setProducts(data) })
      .catch(() => setProducts(getLocal(LS_PRODUCTS)))
    fetch(`${API}/api/orders`).then(r => { if (r.ok) return r.json(); throw 'fail' })
      .then(data => { setLocal(LS_ORDERS, data); setOrders(data) })
      .catch(() => setOrders(getLocal(LS_ORDERS)))
    fetch(`${API}/api/stock`).then(r => { if (r.ok) return r.json(); throw 'fail' })
      .then(data => { setLocal(LS_STOCK, data); setStock(data) })
      .catch(() => setStock(getLocal(LS_STOCK)))
    fetch(`${API}/api/shipments`).then(r => { if (r.ok) return r.json(); throw 'fail' })
      .then(data => { setLocal(LS_SHIPMENTS, data); setShipments(data) })
      .catch(() => setShipments(getLocal(LS_SHIPMENTS)))
    fetch(`${API}/api/stock/details`).then(r => r.json()).then(setInventory).catch(() => {})
    fetch(`${API}/api/preorders`).then(r => r.json()).then(setPreorders).catch(() => {})
    fetch(`${API}/api/writeoffs`).then(r => r.json()).then(setWriteoffs).catch(() => {})
    if (role === 'admin' || role === 'manager') {
      fetch(`${API}/api/agents`, { headers: { 'X-Admin-Role': role } }).then(r => r.ok ? r.json() : []).then(setAgents).catch(() => {})
      fetch(`${API}/api/clients`, { headers: { 'X-Admin-Role': role } }).then(r => r.ok ? r.json() : []).then(setAgentClients).catch(() => {})
    }
  }

  const updateStatus = (id, status) => {
    fetch(`${API}/api/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      .catch(() => {
        const list = getLocal(LS_ORDERS)
        setLocal(LS_ORDERS, list.map(o => o.id === id ? { ...o, status } : o))
        setOrders(list.map(o => o.id === id ? { ...o, status } : o))
      })
    setTimeout(loadData, 300)
  }

  // === SHIPMENT HELPERS ===
  const statusShipLabel = (s) => {
    const map = { 'оформлено': t('confirmed'), 'отгружено': t('shipped'), 'доставлено': t('delivered'), 'отменено': t('cancelled') }
    return map[s] || s
  }
  const statusShipClass = (s) => {
    const map = { 'оформлено': 'ship-status-new', 'отгружено': 'ship-status-shipped', 'доставлено': 'ship-status-delivered', 'отменено': 'ship-status-cancelled' }
    return map[s] || ''
  }

  const openShipFromOrder = (order, orderNum) => {
    const items = recalcShipPrices((order.items || []).map(item => ({
      product_id: item.product_id,
      product_name: item.name,
      color: item.color || '',
      price: item.price || 0,
      qty: item.qty || 0,
      subtotal: (item.price || 0) * (item.qty || 0),
    })))
    setShipOrder(order)
    setShipForm({
      client: { name: order.name, phone: order.phone, city: order.city || '', transport: order.transport || '' },
      items, prepaid: order.prepaid || 0, paid: items.reduce((s, i) => s + (i.price || 0) * (i.qty || 0), 0),
      date: new Date().toISOString().slice(0, 10),
    })
    setShipOrderNum(orderNum)
    setShowShipModal(true)
  }

  const openShipManual = () => {
    setShipOrder(null)
    setShipForm({ client: { name: '', phone: '', city: '', transport: '' }, items: [{ product_id: 0, product_name: '', color: '', price: 0, qty: 0, subtotal: 0 }], prepaid: 0, paid: 0, date: new Date().toISOString().slice(0, 10) })
    setShowShipModal(true)
  }

  const showOrderInvoice = (order, orderNum) => {
    const fakeShip = {
      number: 'Заказ #' + orderNum,
      created_at: order.created_at,
      pickup: order.pickup,
      client: { name: order.name, phone: order.phone, city: order.city || '', transport: order.transport || '' },
      items: (order.items || []).map(item => ({
        product_name: item.name,
        color: item.color || '',
        price: item.price || 0,
        qty: item.qty || 0,
        subtotal: (item.price || 0) * (item.qty || 0),
      })),
      total: order.total || 0,
      pickup_date: order.pickup_date || '',
      assembly: order.assembly || '',
      assembly_total: order.assembly_total || 0,
      prepaid: 0,
      paid: 0,
      status: '—',
    }
    setInvoiceShip(fakeShip)
  }
  const closeShipModal = () => { setShowShipModal(false); setShipOrder(null); setShipOrderNum(0) }

  const getShipPrice = (prod, totalQty) => {
    if (totalQty >= 3 && prod.wholesale_price && Number(prod.wholesale_price) > 0) {
      return Number(prod.wholesale_price)
    }
    return Number(prod.price) || 0
  }

  const recalcShipPrices = (items) => items.map(item => {
    const prod = products.find(p => p.id === item.product_id)
    if (!prod || !item.product_id) return item
    const totalQty = items.reduce((s, i) => s + (i.qty || 0), 0)
    const price = getShipPrice(prod, totalQty)
    return { ...item, price, subtotal: price * (item.qty || 0) }
  })

  const updateShipItem = (idx, field, value) => {
    setShipForm(prev => {
      const items = [...prev.items]
      const item = { ...items[idx], [field]: value }
      // Если меняется модель или цвет — сбрасываем/проверяем количество
      if (field === 'product_id' || field === 'color') {
        const prod = products.find(p => p.id === item.product_id)
        if (prod && item.color) {
          const avail = prod.available_colors?.[item.color] || 0
          if (avail > 0 && item.qty > avail) item.qty = avail
        }
      }
      if (field === 'qty') {
        const prod = products.find(p => p.id === item.product_id)
        if (prod && item.color) {
          const avail = prod.available_colors?.[item.color] || 0
          if (avail > 0 && value > avail) item.qty = avail
        }
      }
      items[idx] = item
      // Пересчитываем цены (опт/розница) с учётом общего количества
      const recalc = recalcShipPrices(items)
      return { ...prev, items: recalc }
    })
  }

  const addShipItem = () => {
    setShipForm(prev => {
      const items = [...prev.items, { product_id: 0, product_name: '', color: '', price: 0, qty: 0, subtotal: 0 }]
      return { ...prev, items: recalcShipPrices(items) }
    })
  }

  const removeShipItem = (idx) => {
    setShipForm(prev => {
      const items = prev.items.filter((_, i) => i !== idx)
      return { ...prev, items: recalcShipPrices(items) }
    })
  }

  const onProductSelect = (idx, productId) => {
    const pid = Number(productId)
    const prod = products.find(p => p.id === pid)
    if (!prod) return
    // Выбираем первый доступный цвет с остатком
    const availColors = Object.entries(prod.available_colors || {}).filter(([,qty]) => qty > 0)
    const firstColor = availColors.length > 0 ? availColors[0][0] : ''
    setShipForm(prev => {
      const items = [...prev.items]
      items[idx] = {
        ...items[idx], product_id: pid, product_name: prod.name,
        price: Number(prod.price) || 0, color: firstColor,
        qty: 1, subtotal: Number(prod.price) || 0,
      }
      return { ...prev, items: recalcShipPrices(items) }
    })
  }

  const shipTotal = () => shipForm.items.reduce((s, i) => s + i.subtotal, 0)

  const createShipment = () => {
    const items = shipForm.items.filter(i => i.qty > 0 && i.product_id > 0)
    if (items.length === 0) return

    // Проверка остатков перед сохранением
    for (const item of items) {
      const prod = products.find(p => p.id === item.product_id)
      if (prod && item.color) {
        const avail = prod.available_colors?.[item.color] || 0
        if (item.qty > avail) {
          alert(`Недостаточно на складе: ${item.product_name} (${item.color}) — доступно ${avail} ${t('pcs')}, указано ${item.qty} ${t('pcs')}`)
          return
        }
      }
    }

    const payload = {
      order_id: shipOrder?.id || null,
      order_number: shipOrderNum || 0,
      client: shipForm.client,
      items,
      total: items.reduce((s, i) => s + i.subtotal, 0),
      date: shipForm.date || new Date().toISOString().slice(0, 10),
      prepaid: Number(shipForm.prepaid) || 0,
      paid: Number(shipForm.paid) || 0,
    }

    const afterShip = () => {
      // Обновляем заказ — сохраняем актуальные модели/цвета/количество
      if (payload.order_id) {
        const orderItems = items.map(i => ({
          product_id: i.product_id,
          name: i.product_name,
          color: i.color,
          price: i.price,
          qty: i.qty,
        }))
        const orderTotal = items.reduce((s, i) => s + (i.price||0) * (i.qty||0), 0)
        fetch(`${API}/api/orders/${payload.order_id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: orderItems, total: orderTotal, status: 'done' }),
        }).catch(() => {
          // Update locally
          const localOrders = getLocal(LS_ORDERS).map(o => o.id === payload.order_id
            ? { ...o, items: orderItems, total: orderTotal, status: 'done' } : o)
          setLocal(LS_ORDERS, localOrders)
        })
      }
    }

    fetch(`${API}/api/shipments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }).then(() => {
      afterShip()
    }).catch(() => {
      const list = getLocal(LS_SHIPMENTS)
      const maxNum = list.reduce((max, s) => {
        const n = parseInt((s.number || '').replace(/\D/g, ''), 10)
        return n > max ? n : max
      }, 0)
      const nextNum = payload.order_number ? payload.order_number : (maxNum + 1)
      list.push({ id: Date.now(), number: 'OUDA-' + String(nextNum).padStart(3, '0'), ...payload, status: 'оформлено', created_at: new Date().toISOString() })
      setLocal(LS_SHIPMENTS, list)
      afterShip()
    })
    setShowShipModal(false)
    setShipOrder(null)
    setTimeout(loadData, 300)
  }

  const confirmShipPayment = () => {
    if (!shipShipment) return
    const extraPay = Number(shipPayAmount) || 0
    const newPaid = (shipShipment.paid || 0) + extraPay
    updateShipment(shipShipment.id, { status: 'отгружено', paid: newPaid })
    setShowShipPayModal(false)
    setShipShipment(null)
  }

  const updateShipment = (id, data) => {
    fetch(`${API}/api/shipments/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).catch(() => {
      const list = getLocal(LS_SHIPMENTS).map(s => s.id === id ? { ...s, ...data } : s)
      setLocal(LS_SHIPMENTS, list)
      setShipments(list)
    })
    setTimeout(loadData, 300)
  }

  // === RECEIVE STOCK MODAL ===
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [receiveStockEntry, setReceiveStockEntry] = useState(null)
  const [receiveColors, setReceiveColors] = useState({})

  const openReceiveModal = (entry) => {
    setReceiveStockEntry(entry)
    // Pre-fill all colors with full qty
    const initial = {}
    Object.entries(entry.colors || {}).forEach(([color, qty]) => { initial[color] = qty })
    setReceiveColors(initial)
    setShowReceiveModal(true)
  }

  const closeReceiveModal = () => {
    setShowReceiveModal(false)
    setReceiveStockEntry(null)
    setReceiveColors({})
  }

  const toggleReceiveColor = (color) => {
    setReceiveColors(prev => {
      const entry = receiveStockEntry
      const maxQty = entry?.colors?.[color] || 0
      if (!(color in prev)) return { ...prev, [color]: maxQty }
      const next = { ...prev }
      delete next[color]
      return next
    })
  }

  const updateReceiveColorQty = (color, delta) => {
    setReceiveColors(prev => {
      const entry = receiveStockEntry
      const maxQty = entry?.colors?.[color] || 0
      const current = prev[color] || 0
      let next = Math.max(0, Math.min(maxQty, current + delta))
      if (next === 0) {
        const copy = { ...prev }
        delete copy[color]
        return copy
      }
      return { ...prev, [color]: next }
    })
  }

  const submitReceive = () => {
    const entry = receiveStockEntry
    if (!entry) return
    const receivedColors = {}
    Object.entries(receiveColors).forEach(([color, qty]) => {
      if (qty > 0) receivedColors[color] = qty
    })
    if (Object.keys(receivedColors).length === 0) return

    fetch(`${API}/api/stock/${entry.id}/receive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receivedColors }),
    }).catch(() => {
      // Offline fallback
      const list = getLocal(LS_STOCK)
      const idx = list.findIndex(s => s.id === entry.id)
      if (idx === -1) return
      const current = list[idx]
      let allReceived = true
      Object.entries(current.colors || {}).forEach(([color, qty]) => {
        const rcv = receivedColors[color] || 0
        if (qty - rcv > 0) allReceived = false
      })
      if (allReceived) {
        list[idx] = { ...current, status: 'received', date: new Date().toISOString().slice(0, 10) }
      } else {
        Object.entries(receivedColors).forEach(([color, qty]) => {
          current.colors[color] = (current.colors[color] || 0) - qty
        })
        Object.keys(current.colors).forEach(c => { if (current.colors[c] <= 0) delete current.colors[c] })
        list[idx] = current
        list.push({
          id: Date.now(),
          product_id: current.product_id,
          product_name: current.product_name,
          date: new Date().toISOString().slice(0, 10),
          status: 'received',
          expected_date: null,
          colors: receivedColors,
        })
      }
      setLocal(LS_STOCK, list)
      setStock(list)
    })
    closeReceiveModal()
    setTimeout(loadData, 300)
  }

  // === PRODUCT & STOCK ===
  const handleStockProductChange = (productId) => {
    setStockForm({ product_id: Number(productId), selectedColors: {}, status: 'received' })
  }

  const toggleStockColor = (colorName) => {
    setStockForm(prev => {
      const sc = { ...prev.selectedColors }
      sc[colorName] = (sc[colorName] || 0) + 1
      return { ...prev, selectedColors: sc }
    })
  }

  const updateStockColorQty = (colorName, delta) => {
    setStockForm(prev => {
      const sc = { ...prev.selectedColors }
      if (sc[colorName] === undefined) return prev
      const newQty = Math.max(0, sc[colorName] + delta)
      if (newQty === 0) {
        delete sc[colorName]
      } else {
        sc[colorName] = newQty
      }
      return { ...prev, selectedColors: sc }
    })
  }

  const handlePhotos = (e, files) => {
    const fileList = files || Array.from(e?.target?.files || [])
    const total = photos.length + fileList.length
    if (total > 7) { alert(t('maxPhotos')); return }
    const newPhotos = fileList.map(f => ({ file: f, url: URL.createObjectURL(f) }))
    setPhotos(prev => [...prev, ...newPhotos])
    if (e?.target) e.target.value = ''
  }

  const removePhoto = (idx) => {
    setPhotos(prev => { URL.revokeObjectURL(prev[idx].url); return prev.filter((_, i) => i !== idx) })
  }

  const handleDragStart = (idx, e) => {
    e.dataTransfer.setData('text/plain', String(idx))
    e.currentTarget.classList.add('dragging')
  }
  const handleDragOver = (e) => { e.preventDefault() }
  const handleDrop = (idx, e) => {
    e.preventDefault()
    const from = parseInt(e.dataTransfer.getData('text/plain'))
    if (isNaN(from) || from === idx) return
    setPhotos(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(idx, 0, moved)
      return next
    })
  }

  const handleDropFiles = (e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length > 0) handlePhotos(null, files)
  }

  const addProduct = async (e) => {
    e.preventDefault()
    const basePrice = Number(newProduct.price) || 0
    const wholesalePrice = Number(newProduct.wholesale_price) || 0
    const assemblyPrice = newProduct.type === 'enduro' ? 12000 : 7000

    // Upload photos first
    let images = []
    if (photos.length > 0) {
      setUploading(true)
      const formData = new FormData()
      photos.forEach(p => formData.append('photos', p.file))
      try {
        const resp = await fetch(`${API}/api/upload`, { method: 'POST', body: formData })
        const data = await resp.json()
        images = data.urls || []
      } catch (e) { console.error('Upload failed', e) }
      setUploading(false)
    }

    const product = { ...newProduct, price: basePrice, wholesale_price: wholesalePrice, assembly_price: assemblyPrice, name: lang === 'zh' ? (newProduct.name_zh || newProduct.name_ru) : (newProduct.name_ru || newProduct.name_zh), images, image: images[0] || '', id: Date.now() }
    const list = getLocal(LS_PRODUCTS)
    list.push(product)
    setLocal(LS_PRODUCTS, list)
    setProducts(list)
    // Отправляем на сервер
    fetch(`${API}/api/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product) })
      .then(r => { if (r.ok) setTimeout(loadData, 300) })
      .catch(() => {})
    setNewProduct({ name_ru: '', name_zh: '', price: '', wholesale_price: '', type: 'scooter', power: '', fuel: '', cooling: '', max_speed: '', wheels: '', description: '', images: [], weight: '', length: '', width: '', height: '' })
    setPhotos([])
  }

  const deleteProduct = (id) => {
    const list = getLocal(LS_PRODUCTS).filter(p => p.id !== id)
    setLocal(LS_PRODUCTS, list)
    setProducts(list)
    fetch(`${API}/api/products/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  const addStock = (e) => {
    e.preventDefault()
    const product = products.find(p => p.id === stockForm.product_id)
    if (!product) { alert('Выберите товар'); return }
    // Build colors object: { colorName: qty, ... }
    const colorsObj = {}
    Object.entries(stockForm.selectedColors).forEach(([name, qty]) => {
      if (qty > 0) colorsObj[name] = qty
    })
    if (Object.keys(colorsObj).length === 0) { alert('Добавьте хотя бы один цвет с количеством'); return }
    const entry = {
      id: Date.now(), product_id: stockForm.product_id, product_name: product.name,
      date: document.getElementById('stock-date')?.value || new Date().toISOString().slice(0, 10),
      status: stockForm.status,
      expected_date: null,
      colors: colorsObj,
    }
    fetch(`${API}/api/stock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) })
      .catch(() => { const list = getLocal(LS_STOCK); list.push(entry); setLocal(LS_STOCK, list) })
    setStockForm({ product_id: '', selectedColors: {}, status: 'received' })
    document.getElementById('stock-product').value = ''
    setTimeout(loadData, 300)
  }

  const statusLabel = (s) => { const map = { new: t('new'), accepted: 'В работе', paid: 'Оплачен', shipped: 'Отгружен', done: t('completed'), cancelled: 'Отменён' }; return map[s] || s }
  const statusClass = (s) => { const map = { new: 'status-new', accepted: 'status-accepted', done: 'status-done' }; return map[s] || '' }
  const logout = () => { sessionStorage.removeItem('ouda_admin'); navigate('/login') }

  // === Agents ===
  const [settings, setSettings] = useState({ retail_reward: 7500, wholesale_reward: 2500 })
  const [newAgentPassword, setNewAgentPassword] = useState('')
  const [lastAgentCode, setLastAgentCode] = useState('')
  const [lastAgentLogin, setLastAgentLogin] = useState('')
  const [agentForm, setAgentForm] = useState({ id: null, name: '', code: '', max_link: '', tg_link: '', wa_link: '', phone: '' })
  const [agentModalOpen, setAgentModalOpen] = useState(false)
  const [clientModal, setClientModal] = useState(null) // agent
  const [clientForm, setClientForm] = useState({ name: '', phone: '+7', city: '', note: '' })

  const loadSettings = () => {
    if (role !== 'admin') return
    fetch(`${API}/api/settings`, { headers: { 'X-Admin-Role': role } }).then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings(d) }).catch(() => {})
  }

  useEffect(() => {
    if (role === 'admin') loadSettings()
  }, [])

  const openAddAgent = () => {
    setNewAgentPassword('')
    setAgentForm({ id: null, name: '', code: '', max_link: '', tg_link: '', wa_link: '', phone: '' })
    setAgentModalOpen(true)
  }

  const openEditAgent = (a) => {
    setNewAgentPassword('')
    setAgentForm({ id: a.id, name: a.name || '', code: a.code || '', max_link: a.max_link || '', tg_link: a.tg_link || '', wa_link: a.wa_link || '', phone: a.phone || '' })
    setAgentModalOpen(true)
  }

  const saveAgent = async () => {
    if (!agentForm.name) { alert('Укажите имя агента'); return }
    try {
      const isNew = !agentForm.id
      const r = await fetch(`${API}/api/agents`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'X-Admin-Role': role, 'Content-Type': 'application/json' },
        body: JSON.stringify(agentForm),
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'Ошибка сохранения'); return }
      const d = await r.json()
      if (isNew) {
        setNewAgentPassword(d.password_plain || '')
        setLastAgentCode(d.code)
        setLastAgentLogin(d.login)
      }
      setAgentForm({ id: null, name: '', code: '', max_link: '', tg_link: '', wa_link: '', phone: '' })
      setAgentModalOpen(false)
      loadData()
    } catch (e) { alert('Ошибка: ' + e.message) }
  }

  const updateAgent = async (id, patch) => {
    await fetch(`${API}/api/agents/${id}`, {
      method: 'PATCH',
      headers: { 'X-Admin-Role': role, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => {})
    loadData()
  }

  const resetAgentPassword = async (a) => {
    if (!confirm(`Сбросить пароль агента ${a.name}?`)) return
    const r = await fetch(`${API}/api/agents/${a.id}/reset-password`, {
      method: 'POST',
      headers: { 'X-Admin-Role': role },
    }).then(r => r.json()).catch(() => ({}))
    if (r.password_plain) {
      const text = `Новый пароль для ${a.name}: ${r.password_plain}. Вход: https://ouda.ru/agent`
      navigator.clipboard.writeText(text).catch(() => {})
      alert('Новый пароль: ' + r.password_plain + ' (скопирован в буфер)')
    }
  }

  const sendAgentData = (a) => {
    const text = `Здравствуйте, ${a.name}! Ваша ссылка: https://ouda.ru/?ref=${a.code} | Вход для агентов: https://ouda.ru/agent | Логин: ${a.login} | Пароль: ${a.password}`
    const waMatch = (a.wa_link || '').match(/wa\.me\/([0-9]+)/)
    if (waMatch) {
      window.open('https://wa.me/' + waMatch[1] + '?text=' + encodeURIComponent(text), '_blank')
    } else if (a.tg_link) {
      window.open(a.tg_link, '_blank')
      navigator.clipboard.writeText(text).catch(() => {})
      alert('Откройте чат и вставьте сообщение (скопировано)')
    } else {
      navigator.clipboard.writeText(text).catch(() => {})
      alert('Ссылка на мессенджер не указана. Сообщение скопировано в буфер.')
    }
  }

  const openClientModal = (a) => {
    setClientModal(a)
    setClientForm({ name: '', phone: '+7', city: '', note: '' })
  }

  const addAgentClient = async (e) => {
    e.preventDefault()
    if (!clientModal || !clientForm.name) return
    await fetch(`${API}/api/agents/${clientModal.id}/clients`, {
      method: 'POST',
      headers: { 'X-Admin-Role': role, 'Content-Type': 'application/json' },
      body: JSON.stringify(clientForm),
    }).catch(() => {})
    setClientModal(null)
    loadData()
  }

  const saveSettings = async () => {
    await fetch(`${API}/api/settings`, {
      method: 'PATCH',
      headers: { 'X-Admin-Role': role, 'Content-Type': 'application/json' },
      body: JSON.stringify({ retail_reward: Number(settings.retail_reward) || 0, wholesale_reward: Number(settings.wholesale_reward) || 0 }),
    }).catch(() => {})
    alert('Ставки сохранены')
    loadData()
  }

  if (!sessionStorage.getItem('ouda_admin')) return null

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <h2>{t('adminTitle')}</h2>
          <div className="lang-switch">
            <button className={`lang-btn ${lang === 'ru' ? 'active' : ''}`} onClick={() => setLang('ru')}>RU</button>
            <button className={`lang-btn ${lang === 'zh' ? 'active' : ''}`} onClick={() => setLang('zh')}>中文</button>
          </div>
        </div>
        <button className="admin-logout" onClick={logout}>{t('logout')}</button>
      </div>
      <div className="admin-content">
        <div className="admin-tabs">
          {[
            { key: 'agents', label: `Агенты (${agents.length})`, role: 'admin' },
            { key: 'products', label: `${t('products')} (${products.length})`, role: 'admin' },
            { key: 'stock', label: `${t('stock')}`, role: 'all' },
            { key: 'inventory', label: t('inventory'), role: 'all' },
            { key: 'orders', label: `${t('orders')} (${orders.filter(o => o.status === 'new').length})`, role: 'admin' },
            { key: 'shipments', label: `${t('shipments')} (${shipments.length})`, role: 'admin' },
            { key: 'preorders', label: `${t('preordersTab')} (${preorders.length})`, role: 'admin' },
            { key: 'writeoffs', label: `${t('writeoffsTab')} (${writeoffs.length})`, role: 'all' },
          ].filter(tabItem => isManager ? tabItem.key === 'agents' : (tabItem.role === 'all' || (tabItem.role === 'admin' && !isSupplier))).map(tabItem => (
            <button key={tabItem.key} className={`admin-tab ${tab === tabItem.key ? 'active' : ''}`}
              onClick={() => setTab(tabItem.key)}>{tabItem.label}</button>
          ))}
        </div>

        {/* === AGENTS TAB === */}
        {tab === 'agents' && (<>
          <div className="v2-products-section">

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
            <button onClick={openAddAgent} style={{background:'linear-gradient(135deg,#667eea,#764ba2)',color:'#fff',padding:'10px 24px',borderRadius:12,fontSize:13,fontWeight:500,border:'none',cursor:'pointer'}}>Добавить агента</button>
            {!isManager && (
              <div style={{display:'flex',alignItems:'center',gap:8,background:'#fff',borderRadius:12,padding:'8px 14px',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
                <span style={{fontSize:12,color:'#777'}}>Ставки:</span>
                <span style={{fontSize:13}}>розница</span>
                <input type="number" className="v2-input" style={{width:80,padding:'6px 10px'}} value={settings.retail_reward} onChange={e => setSettings({...settings, retail_reward: e.target.value})} />
                <span style={{fontSize:13}}>опт</span>
                <input type="number" className="v2-input" style={{width:80,padding:'6px 10px'}} value={settings.wholesale_reward} onChange={e => setSettings({...settings, wholesale_reward: e.target.value})} />
                <button onClick={saveSettings} style={{background:'#1a1a1a',color:'#fff',padding:'7px 16px',borderRadius:8,fontSize:12,border:'none',cursor:'pointer'}}>Сохранить</button>
              </div>
            )}
          </div>

          {newAgentPassword && (
            <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:12,padding:'14px 18px',marginBottom:16,fontSize:13,color:'#065f46'}}>
              Агент создан. Передайте ему доступ:<br/>
              <strong>Ссылка:</strong> https://ouda.ru/?ref={lastAgentCode}<br/>
              <strong>Вход:</strong> https://ouda.ru/agent &nbsp;|&nbsp; <strong>Логин:</strong> {lastAgentLogin} &nbsp;|&nbsp; <strong>Пароль:</strong> {newAgentPassword}
            </div>
          )}

          <div className="v2-card" style={{overflow:'hidden',padding:0}}>
          <div style={{overflowX:'auto',borderRadius:'var(--radius)'}}>
          <table className="admin-table" style={{margin:0}}>
            <thead><tr>
              <th>Агент</th><th>Ссылка</th><th>WhatsApp / Telegram / MAX</th><th>Телефон</th><th>Telegram-бот</th><th>Клики</th><th>Заказы</th><th>Потенц.</th><th>Фактич.</th><th>Клиенты</th><th>Статус</th><th></th>
            </tr></thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.id} style={{borderTop:'1px solid #f0f2ff'}}>
                  <td style={{fontWeight:500}}>{a.name}<div style={{fontSize:11,color:'#888',fontWeight:400}}>логин: {a.login}</div></td>
                  <td style={{whiteSpace:'nowrap'}}><code style={{fontSize:12,background:'#f4f4f6',padding:'3px 8px',borderRadius:6}}>ouda.ru/?ref={a.code}</code></td>
                  <td style={{fontSize:12,whiteSpace:'nowrap'}}>
                    {[
                      a.wa_link ? { label: 'WhatsApp', href: a.wa_link, color: '#25D366' } : null,
                      a.tg_link ? { label: 'Telegram', href: a.tg_link, color: '#229ED9' } : null,
                      a.max_link ? { label: 'MAX', href: a.max_link, color: '#667eea' } : null,
                    ].filter(Boolean).map((l, i) => (
                      <span key={l.label}>{i > 0 && ' · '}<a href={l.href} target="_blank" style={{ color: l.color }}>{l.label}</a></span>
                    ))}
                    {!a.wa_link && !a.tg_link && !a.max_link && '—'}
                  </td>
                  <td>{a.phone || '—'}</td>
                  <td>{a.tg_chat_id ? <span style={{color:'#16a34a',fontSize:12}}>подключён</span> : <span style={{color:'#999',fontSize:12}}>нет</span>}</td>
                  <td>{a.stats ? a.stats.clicks : 0}</td>
                  <td>{a.stats ? a.stats.orders : 0}</td>
                  <td>{a.stats ? Number(a.stats.potential).toLocaleString('ru-RU') : 0} ₽</td>
                  <td style={{fontWeight:600}}>{a.stats ? Number(a.stats.actual).toLocaleString('ru-RU') : 0} ₽</td>
                  <td>{a.stats ? a.stats.clients : 0}</td>
                  <td>{a.status === 'active' ? <span style={{color:'#16a34a',fontSize:12}}>активен</span> : <span style={{color:'#dc2626',fontSize:12}}>заблокирован</span>}</td>
                  <td>
                    <div className="admin-actions" style={{flexDirection:'column',alignItems:'flex-start',gap:4}}>
                      <button className="admin-btn" onClick={() => openEditAgent(a)}>Редактировать</button>
                      <button className="admin-btn" onClick={() => openClientModal(a)}>Добавить клиента</button>
                      <button className="admin-btn" onClick={() => sendAgentData(a)}>Отправить данные</button>
                      <button className="admin-btn" onClick={() => resetAgentPassword(a)}>Сброс пароля</button>
                      {a.status === 'active'
                        ? <button className="admin-btn admin-btn-danger" onClick={() => updateAgent(a.id, {status:'blocked'})}>Заблокировать</button>
                        : <button className="admin-btn" onClick={() => updateAgent(a.id, {status:'active'})}>Разблокировать</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {agents.length===0 && <tr><td colSpan={12} style={{textAlign:'center',color:'#666',padding:40}}>Агентов пока нет — нажмите «Добавить агента»</td></tr>}
            </tbody>
          </table>
          </div>
          </div>

          {/* Список клиентов CRM */}
          <div style={{marginTop:24}}>
            <div className="v2-st">Клиенты агентов (CRM)</div>
            <div className="v2-card" style={{overflow:'hidden',padding:0}}>
            <div style={{overflowX:'auto'}}>
            <table className="admin-table" style={{margin:0}}>
              <thead><tr><th>Клиент</th><th>Телефон</th><th>Город</th><th>Агент</th><th>Источник</th><th>Статус</th><th>Заметка</th><th>Дата</th></tr></thead>
              <tbody>
                {agentClients.map(c => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.phone}</td>
                    <td>{c.city || '—'}</td>
                    <td>{c.agent_name}</td>
                    <td>{c.source === 'site' ? 'С сайта' : 'Свой'}</td>
                    <td>{{new:'Новый',talk:'В переговорах',prepaid:'Внесена предоплата',order:'Заказ',sold:'Продано',lost:'Отказ'}[c.status] || c.status}</td>
                    <td style={{whiteSpace:'normal',wordBreak:'break-word'}}>{c.note || '—'}</td>
                    <td>{formatDate(c.created_at)}</td>
                  </tr>
                ))}
                {agentClients.length===0 && <tr><td colSpan={8} style={{textAlign:'center',color:'#666',padding:40}}>Клиентов пока нет</td></tr>}
              </tbody>
            </table>
            </div>
            </div>
          </div>

          </div>
        </>)}

        {/* === PRODUCTS TAB === */}

                {tab === 'products' && (<>
          <div className="v2-products-section">

          <div className="v2-header" style={{borderRadius:"14px 14px 0 0"}}>
            <h3>{t('addProduct')}</h3>
            <span>Новый товар</span>
          </div>

          <form className="admin-add-form" onSubmit={addProduct} style={{border:'none',padding:0,background:'transparent',boxShadow:'none'}}>

          <div className="v2-form-body">
          <div className="v2-st">Основное</div>
          <div className="v2-card">
            <div className="v2-field full-w">
              <label>Название *</label>
              <input className="v2-input" placeholder={lang === 'zh' ? '名称 *' : 'Название *'} value={lang === 'zh' ? (newProduct.name_zh || newProduct.name_ru) : (newProduct.name_ru || newProduct.name_zh)} onChange={e => {
                const val = e.target.value
                if (lang === 'zh') {
                  setNewProduct(prev => ({...prev, name_zh: val}))
                } else {
                  setNewProduct(prev => ({...prev, name_ru: val}))
                }
              }} required />
            </div>
            <div className="v2-row2">
              <div className="v2-field half">
                <label>Розничная цена *</label>
                <input className="v2-input" placeholder={t('retailPrice')} type="number" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} required />
              </div>
              <div className="v2-field half">
                <label>Оптовая цена</label>
                <input className="v2-input" placeholder={t('wholesalePrice')} type="number" value={newProduct.wholesale_price} onChange={e => setNewProduct({...newProduct, wholesale_price: e.target.value})} />
              </div>
            </div>
            <div className="v2-field">
              <label>Тип</label>
              <select className="v2-input" value={newProduct.type} onChange={e => setNewProduct({...newProduct, type: e.target.value})}>
                <option value="scooter">Скутер</option>
                <option value="enduro">Эндуро</option>
              </select>
            </div>
          </div>

          {/* Характеристики */}
          <div className="v2-st">Характеристики</div>
          <div className="v2-card">
            <div className="v2-row2">
              <div className="v2-field half">
                <label>Мощность</label>
                <select className="v2-input" value={newProduct.power} onChange={e => setNewProduct({...newProduct, power: e.target.value})}>
                  <option value="">{t('power')}</option>
                  <option value="125 / 49">125 / 49</option>
                  <option value="150 / 49">150 / 49</option>
                  <option value="180 / 49">180 / 49</option>
                  <option value="300">300</option>
                </select>
              </div>
              <div className="v2-field half">
                <label>Подача топлива</label>
                <select className="v2-input" value={newProduct.fuel} onChange={e => setNewProduct({...newProduct, fuel: e.target.value})}>
                  <option value="">{t('fuel')}</option>
                  <option value="Карбюратор">{t('carburetor')}</option>
                  <option value="Инжектор">{t('injector')}</option>
                </select>
              </div>
            </div>
            <div className="v2-row3">
              <div className="v2-field third">
                <label>Охлаждение</label>
                <select className="v2-input" value={newProduct.cooling} onChange={e => setNewProduct({...newProduct, cooling: e.target.value})}>
                  <option value="">{t('cooling')}</option>
                  <option value="Воздушное">{t('airCooled')}</option>
                  <option value="Жидкостное">{t('liquidCooled')}</option>
                  <option value="Масляное">Масляное</option>
                </select>
              </div>
              <div className="v2-field third">
                <label>Макс. скорость</label>
                <select className="v2-input" value={newProduct.max_speed} onChange={e => setNewProduct({...newProduct, max_speed: e.target.value})}>
                  <option value="">{t('max_speed')}</option>
                  <option value="95">95</option>
                  <option value="100">100</option>
                  <option value="105">105</option>
                  <option value="110">110</option>
                  <option value="120">120</option>
                </select>
              </div>
              <div className="v2-field third">
                <label>Колёса</label>
                <select className="v2-input" value={newProduct.wheels} onChange={e => setNewProduct({...newProduct, wheels: e.target.value})}>
                  <option value="">{t('wheels')}</option>
                  <option value="10/10">10/10</option>
                  <option value="12/12">12/12</option>
                  <option value="13/13">13/13</option>
                  <option value="13/14">13/14</option>
                  <option value="14/14">14/14</option>
                  <option value="21/18">21/18</option>
                </select>
              </div>
            </div>
            <div className="v2-field full-w">
              <label>Описание</label>
              <textarea className="v2-input" style={{resize:'vertical',minHeight:60}} placeholder={lang === 'zh' ? '描述' : 'Описание'} value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
            </div>
          </div>

          {/* Фото */}
          <div className="v2-st">Фото</div>
          <div className="v2-card">
            <div className="full-width photo-upload-area"
              onDragOver={handleDragOver}
              onDrop={handleDropFiles}
              style={{border:'2px dashed #e0e7ff',borderRadius:12,padding:30,textAlign:'center',color:'#667eea',fontSize:13}}
            >
              <label className="photo-upload-label">
                {uploading ? t('uploading') : t('uploadPhotos')}
                <input type="file" accept="image/*" multiple onChange={handlePhotos} disabled={uploading} hidden />
              </label>
              {photos.length > 0 && (
                <div className="photo-previews" style={{display:'flex',gap:10,marginTop:12,flexWrap:'wrap',justifyContent:'center'}}>
                  {photos.map((p, i) => (
                    <div key={i}
                      className="photo-preview"
                      draggable
                      onDragStart={(e) => handleDragStart(i, e)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(i, e)}
                      onDragEnd={(e) => { e.currentTarget.classList.remove('dragging') }}
                      style={{width:80,height:80,borderRadius:12,overflow:'hidden',position:'relative'}}
                    >
                      <img src={p.url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                      <button type="button" className="photo-remove" onClick={() => removePhoto(i)}>&times;</button>
                      <div className="photo-order" style={{position:'absolute',bottom:2,left:2,background:'rgba(0,0,0,0.5)',color:'#fff',fontSize:10,padding:'1px 6px',borderRadius:4}}>{i + 1}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:10,margin:'16px 0'}}>
            <button type="button" className="v2-btn v2-btn-cancel">{t('cancelText')}</button>
            <button type="submit" className="v2-btn v2-btn-primary">{t('addProduct')}</button>
          </div>

          </form>

          {/* Таблица товаров */}
                    <div className="v2-card" style={{padding:0}}>
          <div style={{borderRadius:12,overflow:'hidden',border:'1px solid #f0f2ff'}}>
          <div style={{overflowX:'auto'}}>
          <table className="admin-table" style={{margin:0,border:'none',boxShadow:'none',width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              <th style={{padding:'12px 16px',textAlign:'left',whiteSpace:'nowrap',fontSize:11,color:'#667eea',fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',borderBottom:'1px solid #f0f2ff',background:'#f8f9ff'}}>{t('nameLabel')}</th>
              <th style={{padding:'12px 16px',textAlign:'left',whiteSpace:'nowrap',fontSize:11,color:'#667eea',fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',borderBottom:'1px solid #f0f2ff',background:'#f8f9ff'}}>Розница</th>
              <th style={{padding:'12px 16px',textAlign:'left',whiteSpace:'nowrap',fontSize:11,color:'#667eea',fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',borderBottom:'1px solid #f0f2ff',background:'#f8f9ff'}}>Опт</th>
              <th style={{padding:'12px 16px',textAlign:'left',whiteSpace:'nowrap',fontSize:11,color:'#667eea',fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',borderBottom:'1px solid #f0f2ff',background:'#f8f9ff'}}>{t('power')}</th>
              <th style={{padding:'12px 16px',textAlign:'left',whiteSpace:'nowrap',fontSize:11,color:'#667eea',fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',borderBottom:'1px solid #f0f2ff',background:'#f8f9ff'}}>{t('fuel')}</th>
              <th style={{padding:'12px 16px',textAlign:'left',whiteSpace:'nowrap',fontSize:11,color:'#667eea',fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',borderBottom:'1px solid #f0f2ff',background:'#f8f9ff'}}>{t('wheels')}</th>
              <th style={{padding:'12px 16px',textAlign:'left',whiteSpace:'nowrap',fontSize:11,color:'#667eea',fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',borderBottom:'1px solid #f0f2ff',background:'#f8f9ff'}}></th>
            </tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} style={{cursor:'pointer',borderBottom:'1px solid #f0f2ff'}} onClick={() => openEditProduct(p)}
                  onMouseOver={e => e.currentTarget.style.background='#fafbff'} onMouseOut={e => e.currentTarget.style.background=''}>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{lang === 'zh' ? (p.name_zh || p.name) : (p.name_ru || p.name)}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{p.price.toLocaleString('ru-RU')} ₽</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{p.wholesale_price ? Number(p.wholesale_price).toLocaleString('ru-RU') + ' ₽' : '—'}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{p.power||'—'}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{p.fuel||'—'}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{p.wheels||'—'}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}><button style={{background:'linear-gradient(135deg,#667eea,#764ba2)',color:'#fff',padding:'5px 14px',borderRadius:8,fontSize:11,border:'none',cursor:'pointer',fontWeight:500}} onClick={(e) => { e.stopPropagation(); deleteProduct(p.id) }}>{t('delete')}</button></td>
                </tr>
              ))}
              {products.length===0 && <tr><td colSpan={7} style={{textAlign:'center',color:'#666',padding:40}}>{t('noProducts')}</td></tr>}
            </tbody>
          </table>
          </div>
          </div>
          </div>

          </div>
        </>)}
{tab === 'stock' && (<>
          <form className="admin-add-form" onSubmit={addStock}>
            <h3>{t('addStock')}</h3>
            <div className="form-grid">
              <select id="stock-product" className="full-width" onChange={e => handleStockProductChange(e.target.value)} defaultValue="">
                <option value="">{t('selectProduct')}</option>
                {products.map(p => <option key={p.id} value={p.id}>{lang === 'zh' ? (p.name_zh || p.name) : (p.name_ru || p.name)}</option>)}
              </select>
              {stockForm.product_id > 0 && (
                <>
                <div className="full-width" style={{display:'flex',gap:12,marginBottom:12}}>
                  <select className="stock-status-select" value={stockForm.status} onChange={e => setStockForm(prev => ({...prev, status: e.target.value}))}>
                    <option value="received">{t('inStockStatus')}</option>
                    <option value="transit">{t('inTransitStatus')}</option>
                  </select>
                </div>
                <div className="full-width stock-color-picker">
                  <div className="palette">
                    {PRESET_COLORS.map(pc => {
                      const selected = stockForm.selectedColors[pc.name] !== undefined
                      return (
                        <div key={pc.hex}
                          className={`palette-color ${selected ? 'selected' : ''}`}
                          onClick={() => toggleStockColor(pc.name)}
                        >
                          <div className={`swatch ${pc.hex === 'chameleon' ? 'color-swatch-chameleon' : ''}`}
                            style={pc.hex !== 'chameleon' ? { background: pc.hex } : {}} />
                          <span className="palette-label">{lang === 'zh' ? (pc.nameZh || pc.name) : pc.name}</span>
                        </div>
                      )
                    })}
                  </div>
                  {Object.entries(stockForm.selectedColors).filter(([,qty]) => qty > 0).length > 0 && (
                    <div className="stock-selected-colors">
                      <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:8}}>Выбрано:</div>
                      {Object.entries(stockForm.selectedColors).filter(([,qty]) => qty > 0).map(([name, qty]) => {
                        const pc = PRESET_COLORS.find(c => c.name === name)
                        return (
                          <div key={name} className="stock-color-row">
                            <div className={`color-swatch ${pc?.hex === 'chameleon' ? 'color-swatch-chameleon' : ''}`}
                              style={pc?.hex && pc.hex !== 'chameleon' ? {background:pc.hex,width:16,height:16,cursor:'default'} : pc?.hex === 'chameleon' ? {background:'linear-gradient(135deg, #8b5cf6, #6366f1, #3b82f6)',width:16,height:16,cursor:'default'} : {width:16,height:16,cursor:'default'}} />
                            <span className="stock-color-name">{lang === 'zh' && pc?.nameZh ? pc.nameZh : name}</span>
                            <button type="button" className="stock-qty-btn" onClick={() => updateStockColorQty(name, -1)}>−</button>
                            <span className="stock-qty">{qty}</span>
                            <button type="button" className="stock-qty-btn" onClick={() => updateStockColorQty(name, 1)}>+</button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
              )}
              <input id="stock-date" name="date" type="date" className="full-width" defaultValue={new Date().toISOString().slice(0,10)} />
              <button type="submit" className="v2-btn v2-btn-primary">{t('addStock')}</button>
            </div>
          </form>
          <div className="stock-list">
            {stock.map(s => (
              <div key={s.id} className="stock-card stock-card-clickable"
                onClick={function() { setDeleteStockItem(s.id) }}>
                <div className="stock-card-head">
                  <strong className="stock-card-name">{s.product_name}</strong>
                  {s.status==='received' ? (
                    <span className="admin-badge badge-received">
                      {t('received')} {formatShortDate(s.date)}
                    </span>
                  ) : (
                    <span className="admin-badge badge-transit clickable-badge"
                      onClick={function(e) { e.stopPropagation(); openReceiveModal(s) }} title="Нажмите чтобы подтвердить получение">
                      {t('inTransit')} {formatShortDate(s.date)}
                    </span>
                  )}
                </div>
                {s.colors && Object.entries(s.colors).filter(([,v]) => v > 0).length > 0 && (
                  <div className="stock-card-colors">
                    {Object.entries(s.colors).filter(([,v]) => v > 0).map(([color, qty]) => (
                      <span key={color} className="stock-color-chip">
                        <span className={`stock-chip-swatch ${getColorHex(color) === 'chameleon' ? 'stock-chip-chameleon' : ''}`}
                          style={getColorHex(color) !== 'chameleon' ? {background: getColorHex(color)} : {}} />
                        {translateColor(color)} {qty} {t("pcs")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {stock.length===0 && <p style={{color:'#666',textAlign:'center',padding:40}}>{t('noStock')}</p>}
          </div>

          {deleteStockItem && (
            <div className="modal-overlay" onClick={function() { setDeleteStockItem(null) }}>
              <div className="modal" style={{maxWidth:380}} onClick={function(e) { e.stopPropagation() }}>
                <div style={{padding:24,textAlign:'center'}}>
                  <h3 style={{margin:'0 0 16px',fontSize:18,fontWeight:600}}>{t('deleteConfirm')}</h3>
                  <div style={{display:'flex',gap:12,justifyContent:'center'}}>
                    <button className="admin-btn" style={{padding:'8px 24px'}} onClick={function() { setDeleteStockItem(null) }}>{t('cancelText')}</button>
                    <button className="admin-btn admin-btn-danger" style={{padding:'8px 24px'}} onClick={async function() {
                      await fetch(API + '/api/stock/' + deleteStockItem, { method: 'DELETE' })
                      setDeleteStockItem(null)
                      fetch(API + '/api/stock').then(function(r) { return r.json() }).then(setStock).catch(function() {})
                      fetch(API + '/api/products').then(function(r) { return r.json() }).then(setProducts).catch(function() {})
                    }}>{t('yes')}</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>)}
      </div>

      {/* === INVENTORY TAB === */}
        {tab === 'inventory' && (<>
          <div style={{margin:'0 24px 16px', display:'flex', alignItems:'baseline', gap:12}}>
            <h3 style={{fontSize:15,fontWeight:600, whiteSpace:'nowrap'}}>{t('inventoryTitle')}</h3>
            {(() => {
              const totalAll = inventory.reduce((s, d) => s + (d.totalAvailable || 0), 0)
              const transitAll = inventory.reduce((s, d) => s + (d.totalInTransit || 0), 0)
              if (totalAll === 0 && transitAll === 0) return null
              return (
                <span style={{fontSize:13,color:'#666'}}>
                  {t('totalLabel')}: <b style={{color:'#1a1a1a'}}>{totalAll}</b> {t('pcs')}{transitAll > 0 ? <> | {t('inTransit')}: <b style={{color:'#1a1a1a'}}>{transitAll}</b> {t('pcs')}</> : ''}
                </span>
              )
            })()}
          </div>
          {inventory.filter(d => d.totalAvailable > 0 || d.totalReceived > 0 || d.totalInTransit > 0).map(d => (
            <div key={d.product_id} className="inventory-card" style={{margin:'0 24px 16px'}}>
              <div className="inv-header">
                <strong>{d.product_name}</strong>
                <span className="inv-total">{t('totalItems')}: <b>{d.totalAvailable}</b> {t('pcs')}{d.totalInTransit > 0 ? `, ${t('inTransit').toLowerCase()}: ${d.totalInTransit} ${t('pcs')}` : ''}</span>
              </div>
              <div className="inv-table-wrap"><table className="inv-table">
                <thead><tr>
                  <th>{t('color')}</th><th>{t('received')}</th><th>{t('inTransit')}</th><th>{t('writeoffQty')}</th><th>{t('shippedOut')}</th><th>{t('available')}</th><th></th>
                </tr></thead>
                <tbody>
                  {d.colors.filter(c => c.received > 0 || c.available > 0 || c.inTransit > 0).map(function(c) {
                    const wCnt = writeoffs.reduce(function(s, w) { 
                      let cnt = 0
                      if (w.items && Array.isArray(w.items)) {
                        w.items.forEach(function(item) {
                          if (item.product_name === d.product_name) {
                            Object.entries(item.colors || {}).forEach(function(e) {
                              if (e[0] === c.color) cnt += (e[1] || 0)
                            })
                          }
                        })
                      } else if (w.colors && typeof w.colors === 'object') {
                        cnt = Object.entries(w.colors).reduce(function(ss, e) { return ss + (e[1] || 0) }, 0)
                      } else if (w.color) {
                        cnt = w.qty || 0
                      }
                      return s + cnt
                    }, 0)
                    return (
                    <tr key={c.color}>
                      <td>
                        <div className="inv-color-cell">
                          <div className={`color-swatch ${getColorHex(c.color) === 'chameleon' ? 'color-swatch-chameleon' : ''}`}
                            style={getColorHex(c.color) !== 'chameleon' ? {background:getColorHex(c.color),width:16,height:16,cursor:'default'} : {width:16,height:16,cursor:'default'}} />
                          <span>{translateColor(c.color)}</span>
                        </div>
                      </td>
                      <td>{c.received}</td>
                      <td>{(c.inTransit || 0) > 0 ? `${c.inTransit} ${c.expected_date ? '(до ' + c.expected_date + ')' : ''}` : '—'}</td>
                      <td>{wCnt || '—'}</td>
                      <td>{c.shipped}</td>
                      <td><strong className={c.available === 0 ? 'inv-zero' : 'inv-ok'}>{c.available}</strong></td>
                      <td>
                        {c.available > 0
                          ? <span className="inv-badge">{t('inStock')}</span>
                          : c.inTransit > 0
                            ? <span className="inv-badge inv-badge-out" style={{background:'#fff3cd',color:'#856404'}}>{t('inTransit')}</span>
                            : c.received > 0
                              ? <span className="inv-badge inv-badge-out">{t('none')}</span>
                              : <span className="inv-badge inv-badge-none">{t('neverHad')}</span>
                        }
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table></div>
            </div>
          ))}
          {inventory.filter(d => d.totalAvailable > 0 || d.totalReceived > 0 || d.totalInTransit > 0).length === 0 && (
            <p style={{color:'#666',textAlign:'center',padding:40}}>{t('noInventory')}</p>
          )}
        </>)}

        {/* === ORDERS TAB === */}
        {tab === 'orders' && (<>
          <div className="v2-products-section">
          <div className="v2-card" style={{overflow:'hidden',padding:0}}>
          <div style={{overflowX:'auto',borderRadius:'var(--radius)'}}>
          <table className="admin-table" style={{margin:0}}>
            <thead><tr>
              <th>№</th><th>{t('date')}</th><th>Имя</th><th>{t('city')}</th><th>Терминал / ТК</th><th>Доставка</th><th>Дата самовывоза</th><th>Номер телефона</th><th>Агент</th>
              <th>{t('products')}</th><th>{t('total')}</th><th>{t('payment')}</th><th>{t('status')}</th><th></th>
            </tr></thead>
            <tbody>
              {[...orders].sort((a, b) => {
                const priority = { 'new': 0, 'accepted': 1, 'paid': 2, 'shipped': 3, 'done': 4, 'cancelled': 5 }
                const pa = priority[a.status] ?? 4
                const pb = priority[b.status] ?? 4
                if (pa !== pb) return pa - pb
                // Внутри одной группы — новые сверху
                return new Date(b.created_at) - new Date(a.created_at)
              }).map((o, i) => (
                <tr key={o.id}>
                  <td>{i+1}</td>
                  <td>{formatDate(o.created_at)}</td>
                  <td>{o.name}</td>
                  <td>{o.pickup ? 'Москва' : (o.city||'—')}</td>
                  <td>{o.pickup ? 'Самовывоз (Москва)' : (o.delivery_terminal || o.transport || '—')}</td>
                  <td>{o.delivery_cost ? Number(o.delivery_cost).toLocaleString('ru-RU') + ' ₽' : '—'}</td>
                  <td>{o.pickup_date || '—'}{o.pickup_time ? ' ' + o.pickup_time : ''}</td>
                  <td>{o.phone}</td>
                  <td>{(agents.find(a => a.id === o.agent_id) || {}).name || '—'}</td>
                  <td style={{minWidth:280,whiteSpace:'normal',wordBreak:'break-word'}}>
                    {o.items?.map(item => `${item.name} ×${item.qty}${item.color ? ' ('+item.color+')' : ''}`).join(', ')||'—'}
                    {o.assembly ? <div style={{fontSize:11,color:'#888',marginTop:4}}>🔧 Сборка: {o.assembly}{o.assembly_total > 0 ? ` (+${Number(o.assembly_total).toLocaleString('ru-RU')} ₽)` : ''}</div> : ''}
                  </td>
                  <td>{(o.total||0).toLocaleString('ru-RU')} ₽</td>
                  <td>
                    {o.prepaid > 0 && <div style={{fontSize:12,color:'#b45309',fontWeight:600}}>Предоплата: {Number(o.prepaid).toLocaleString('ru-RU')} ₽</div>}
                    {o.payment==='usdt'?'USDT':o.payment==='discuss'?'Хочу обсудить дополнительно':t('cash')}
                  </td>
                  <td>{statusLabel(o.status)}</td>
                  <td>
                    <div className="admin-actions">
                      {o.status==='new' && <><button className="admin-btn admin-btn-accept" onClick={() => updateStatus(o.id,'accepted')}>{t('takeToWork')}</button><button className="admin-btn admin-btn-danger" onClick={() => updateStatus(o.id,'cancelled')}>{t('cancel')}</button></>}
                      {['new','accepted'].includes(o.status) && <button className="admin-btn" onClick={() => updateStatus(o.id,'paid')}>Оплачен</button>}
                      {o.status==='paid' && <button className="admin-btn admin-btn-ship" onClick={() => updateStatus(o.id,'shipped')} style={{background:"linear-gradient(135deg,#667eea,#764ba2)",color:"#fff",padding:"5px 12px",borderRadius:8,fontSize:13,border:"none",cursor:"pointer",fontWeight:500}}>Отгружен</button>}
                      {o.status==='shipped' && <button className="admin-btn admin-btn-done" onClick={() => updateStatus(o.id,'done')}>Завершён</button>}
                      {o.status==='accepted' && <button className="admin-btn admin-btn-ship" onClick={() => openShipFromOrder(o, i+1)} style={{background:"linear-gradient(135deg,#667eea,#764ba2)",color:"#fff",padding:"5px 12px",borderRadius:8,fontSize:13,border:"none",cursor:"pointer",fontWeight:500}}>{t('ship')}</button>}
                      <button className="admin-btn admin-btn-invoice" onClick={() => showOrderInvoice(o, i+1)} style={{background:"none",color:"#667eea",padding:"5px 10px",borderRadius:8,fontSize:12,border:"1px solid #667eea",cursor:"pointer"}}>{t('invoice')}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length===0 && <tr><td colSpan={14} style={{textAlign:'center',color:'#666',padding:40}}>{t('noOrders')}</td></tr>}
            </tbody>
          </table>
          </div>
          </div>
          </div>
        </>)}

        {/* === SHIPMENTS TAB === */}
        {tab === 'shipments' && (<>
          <div className="v2-products-section">
          <div className="v2-card" style={{overflow:'hidden',padding:0}}>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
            <button onClick={openShipManual} style={{background:'linear-gradient(135deg,#667eea,#764ba2)',color:'#fff',padding:'10px 24px',borderRadius:12,fontSize:13,fontWeight:500,border:'none',cursor:'pointer',marginRight:8}}>Новая отгрузка</button>
          </div>
          <div style={{margin:'0 24px 24px'}}>
          <div style={{overflowX:'auto',borderRadius:'var(--radius)'}}>
          <table className="admin-table" style={{margin:0}}>
            <thead><tr>
              <th>№</th><th>{t('date')}</th><th>{t('client')}</th><th>{t('phoneLabel')}</th><th>{t('product')}</th>
              <th>{t('amount')}</th><th>{t('payment')}</th><th>{t('status')}</th><th></th>
            </tr></thead>
            <tbody>
              {shipments.map(s => (
                <tr key={s.id} style={{borderTop:'1px solid #f0f2ff',transition:'background .15s'}}
                  onMouseOver={e => e.currentTarget.style.background='#fafbff'} onMouseOut={e => e.currentTarget.style.background=''}>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{s.number}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{formatDate(s.created_at)}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{s.client?.name || '—'}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{s.client?.phone || '—'}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>
                    {(s.items || []).map(item => `${item.product_name}${item.color ? ' ('+item.color+')' : ''} ×${item.qty}`).join(', ')}
                    {s.assembly ? <span style={{fontSize:11,color:'#888'}}> 🔧 Сборка {s.assembly}</span> : ''}
                  </td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{(s.total||0).toLocaleString('ru-RU')} ₽</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>
                    {s.prepaid > 0 && <div style={{color:'#888',fontSize:12}}>Предоплата: {(s.prepaid||0).toLocaleString('ru-RU')} ₽</div>}
                    {s.paid > 0 && s.paid >= s.total
                      ? <div style={{color:'#333'}}>Оплачено полностью</div>
                      : <div style={{color:'#333'}}>К оплате: {((s.total||0) - Math.max(s.paid||0, s.prepaid||0)).toLocaleString('ru-RU')} ₽</div>
                    }
                  </td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{statusShipLabel(s.status)}</td>
                  <td>
                    <div className="admin-actions">
                      {s.status === 'оформлено' && <>
                        <button className="admin-btn admin-btn-accept" onClick={() => { setShipShipment(s); setShipPayAmount(''); setShowShipPayModal(true) }}>{t('ship')}</button>
                        <button className="admin-btn admin-btn-danger" onClick={() => updateShipment(s.id,{status:'отменено'})}>✕ {t('cancelText')}</button>
                      </>}
                      {s.status === 'отгружено' && <>
                        <button className="admin-btn admin-btn-done" onClick={() => updateShipment(s.id,{status:'доставлено'})}>Доставлено</button>
                      </>}
                      <button className="admin-btn admin-btn-invoice" onClick={() => setInvoiceShip(s)} style={{background:"none",color:"#667eea",padding:"5px 10px",borderRadius:8,fontSize:12,border:"1px solid #667eea",cursor:"pointer"}}>{t('invoice')}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {shipments.length===0 && <tr><td colSpan={9} style={{textAlign:'center',color:'#666',padding:40}}>{t('noShipments')}</td></tr>}
            </tbody>
          </table>
          </div>
          </div>
          </div>
          </div>
        </>)}

        {/* === PREORDERS TAB === */}
        {tab === 'preorders' && (<>
          <div className="v2-products-section">
          <div className="v2-card" style={{overflow:'hidden',padding:0}}>
          <div style={{margin:'0 24px 24px'}}>
          <div style={{overflowX:'auto',borderRadius:'var(--radius)'}}>
          <table className="admin-table" style={{margin:0}}>
            <thead><tr>
              <th>№</th><th>Дата</th><th>Модель</th><th>Имя</th><th>Телефон</th><th>Кол-во</th><th>Город</th><th></th>
            </tr></thead>
            <tbody>
              {preorders.map((p, i) => (
                <tr key={p.id} style={{borderTop:'1px solid #f0f2ff',transition:'background .15s'}}
                  onMouseOver={e => e.currentTarget.style.background='#fafbff'} onMouseOut={e => e.currentTarget.style.background=''}>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{i+1}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{new Date(p.created_at).toLocaleDateString('ru-RU')}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap',fontWeight:500}}>{p.product_name}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{p.name}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{p.phone}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{p.qty}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{p.city}</td>
                  <td>
                    <button className="admin-btn admin-btn-danger" onClick={async () => {
                      if (!confirm(t('deletePreorder'))) return
                      await fetch(`${API}/api/preorders/${p.id}`, {method:'DELETE'})
                      setPreorders(prev => prev.filter(x => x.id !== p.id))
                    }} style={{padding:'5px 10px',fontSize:12}}>✕</button>
                  </td>
                </tr>
              ))}
              {preorders.length===0 && <tr><td colSpan={8} style={{textAlign:'center',color:'#666',padding:40}}>{t('noPreorders')}</td></tr>}
            </tbody>
          </table>
          </div>
          </div>
          </div>
          </div>
        </>)}

        {/* === WRITEOFFS TAB === */}
        {tab === 'writeoffs' && (<>
          <div className="v2-products-section">
          <div className="v2-card" style={{overflow:'hidden',padding:0}}>

          {/* Form */}
          <div style={{padding:'20px 24px',borderBottom:'1px solid var(--border)'}}>
            <div className="v2-field" style={{marginBottom:16}}>
              <label>{t('reasonLabel')}</label>
              <select className="v2-input" value={writeoffForm.reason}
                onChange={function(e) { setWriteoffForm({ ...writeoffForm, reason: e.target.value }) }}>
                <option value="sale">{t('saleReason')}</option>
                <option value="error">{t('errorReason')}</option>
                <option value="damage">{t('damageReason')}</option>
                <option value="other">{t('otherReason')}</option>
              </select>
            </div>

            {/* Sale fields */}
            {writeoffForm.reason === 'sale' && (
              <>
                <div className="v2-row2" style={{marginBottom:12}}>
                  <div className="v2-field">
                    <label>{t('clientName')}</label>
                    <input className="v2-input" placeholder={t('clientName')} value={writeoffForm.client_name}
                      onChange={function(e) { setWriteoffForm({ ...writeoffForm, client_name: e.target.value }) }} />
                  </div>
                  <div className="v2-field">
                    <label>{t('phoneLabel')}</label>
                    <input className="v2-input" type="tel" placeholder={t('phoneLabel')} value={writeoffForm.client_phone}
                      onChange={function(e) { setWriteoffForm({ ...writeoffForm, client_phone: e.target.value }) }} />
                  </div>
                </div>
                <div style={{marginBottom:12}}>
                  <div className="v2-field">
                    <label>{t('priceLabel')}</label>
                    <input className="v2-input" type="number" placeholder={t('priceLabel')} value={writeoffForm.price}
                      onChange={function(e) { setWriteoffForm({ ...writeoffForm, price: e.target.value }) }} />
                  </div>
                </div>
              </>
            )}

            {/* Items */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:13,color:'#666',marginBottom:12}}>{t('writeoffItems')}</div>
              {writeoffForm.items.map(function(item, idx) {
                return (
                  <div key={idx} style={{border:'1px solid var(--border)',borderRadius:12,padding:16,marginBottom:12,background:'var(--bg-card)'}}>
                    <div style={{display:'flex',gap:12,alignItems:'flex-end',flexWrap:'wrap',marginBottom:8}}>
                      <div className="v2-field" style={{minWidth:180}}>
                        <label>{t('productLabel')} {idx+1}</label>
                        <select className="v2-input" value={item.product_id}
                          onChange={function(e) {
                            const p = products.find(function(x) { return x.id == e.target.value })
                            var items = writeoffForm.items.slice()
                            items[idx] = { product_id: e.target.value, product_name: p ? p.name : '', colors: {} }
                            setWriteoffForm({ ...writeoffForm, items: items })
                          }}>
                          <option value="">{t('selectProductPlaceholder')}</option>
                          {products.map(function(p) { return <option key={p.id} value={p.id}>{p.name}</option> })}
                        </select>
                      </div>
                      {writeoffForm.items.length > 1 && (
                        <button type="button" className="admin-btn admin-btn-danger" style={{padding:'6px 10px',fontSize:12}}
                          onClick={function() {
                            var items = writeoffForm.items.filter(function(_, i) { return i !== idx })
                            setWriteoffForm({ ...writeoffForm, items: items })
                          }}>✕</button>
                      )}
                    </div>

                    {item.product_id > 0 && (function() {
                      var p = products.find(function(x) { return x.id == item.product_id })
                      if (!p) return null
                      var avail = p.available_colors || {}
                      var colorsWithStock = Object.entries(avail).filter(function(e) { return e[1] > 0 })
                      if (colorsWithStock.length === 0) {
                        return <div style={{marginTop:8,color:'#888',fontSize:13}}>{t('noStockWriteoff')}</div>
                      }
                      return (
                        <div>
                          <div style={{marginTop:8,marginBottom:8,fontSize:12,color:'#888'}}>{t('specifyColors')}</div>
                          {colorsWithStock.map(function(e) {
                            var color = e[0], stock = e[1]
                            var wQty = item.colors[color] || 0
                            return (
                              <div key={color} className="stock-color-row" style={{marginBottom:6}}>
                                <div className="color-swatch" style={getColorHex(color) !== 'chameleon' ? {background:getColorHex(color),width:14,height:14,cursor:'default',borderRadius:'50%'} : {background:'linear-gradient(135deg,#8b5cf6,#6366f1,#3b82f6)',width:14,height:14,cursor:'default',borderRadius:'50%'}} />
                                <span className="stock-color-name" style={{fontWeight:500,fontSize:13}}>{translateColor(color)}</span>
                                <span style={{fontSize:11,color:'#888',marginRight:8}}>{t('inStock')}: {stock} {t('pcs')}</span>
                                <button type="button" className="stock-qty-btn" onClick={function() {
                                  var items = writeoffForm.items.slice()
                                  var c = { ...items[idx].colors }
                                  c[color] = Math.max(0, (c[color] || 0) - 1)
                                  items[idx] = { ...items[idx], colors: c }
                                  setWriteoffForm({ ...writeoffForm, items: items })
                                }}>−</button>
                                <span className="stock-qty" style={wQty > 0 ? {color:'#e53e3e',fontWeight:700} : {}}>{wQty}</span>
                                <button type="button" className="stock-qty-btn" onClick={function() {
                                  var items = writeoffForm.items.slice()
                                  var c = { ...items[idx].colors }
                                  c[color] = Math.min(stock, (c[color] || 0) + 1)
                                  items[idx] = { ...items[idx], colors: c }
                                  setWriteoffForm({ ...writeoffForm, items: items })
                                }}>+</button>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
              <button type="button" className="admin-btn admin-btn-add-item"
                onClick={function() {
                  setWriteoffForm({ ...writeoffForm, items: writeoffForm.items.concat({ product_id: '', product_name: '', colors: {} }) })
                }}>{t('addPosition')}</button>
            </div>

            <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
              <button style={{background:'linear-gradient(135deg, #667eea, #764ba2)',color:'#fff',padding:'10px 24px',borderRadius:'12px',fontSize:13,fontWeight:500,border:'none',cursor:'pointer'}} onClick={async function() {
                var items = []
                for (var i = 0; i < writeoffForm.items.length; i++) {
                  var item = writeoffForm.items[i]
                  var colors = {}
                  var entries = Object.entries(item.colors)
                  for (var j = 0; j < entries.length; j++) {
                    if (entries[j][1] > 0) colors[entries[j][0]] = entries[j][1]
                  }
                  if (item.product_id && Object.keys(colors).length > 0) {
                    items.push({ product_id: item.product_id, product_name: item.product_name, colors: colors })
                  }
                }
                if (items.length === 0) return
                var data = { items: items, reason: writeoffForm.reason, comment: writeoffForm.comment }
                if (writeoffForm.reason === 'sale') {
                  data.client_name = writeoffForm.client_name
                  data.client_phone = writeoffForm.client_phone
                  data.price = Number(writeoffForm.price) || 0
                }
                await fetch(API + '/api/writeoffs', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(data),
                })
                setWriteoffForm({ items: [{ product_id: '', product_name: '', colors: {} }], reason: 'sale', comment: '', client_name: '', client_phone: '+7', price: '' })
                fetch(API + '/api/writeoffs').then(function(r) { return r.json() }).then(setWriteoffs).catch(function() {})
              }} className="writeoff-submit-btn">{t('writeoffBtn')}</button>
            </div>

            <div className="v2-field" style={{marginTop:12}}>
              <label>{t('commentLabel')}</label>
              <input className="v2-input" placeholder={t('commentPlaceholder')} value={writeoffForm.comment}
                onChange={function(e) { setWriteoffForm({ ...writeoffForm, comment: e.target.value }) }} />
            </div>
          </div>

          {/* Table */}
          <div style={{margin:'0 24px 24px'}}>
          <div style={{overflowX:'auto',borderRadius:'var(--radius)'}}>
          <table className="admin-table" style={{margin:0}}>
            <thead><tr>
              <th>№</th><th>{t('date')}</th><th>{t('productLabel')}</th><th>{t('colorLabel')}</th><th>{t('qtyLabel')}</th><th>{t('reasonLabel')}</th><th>{t('clientName')}</th><th>{t('phoneLabel')}</th><th>{t('priceLabel')}</th><th>{t('commentLabel')}</th><th></th>
            </tr></thead>
            <tbody>
              {writeoffs.map((w, i) => (
                <tr key={w.id} style={{borderTop:'1px solid #f0f2ff',transition:'background .15s'}}
                  onMouseOver={e => e.currentTarget.style.background='#fafbff'} onMouseOut={e => e.currentTarget.style.background=''}>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{i+1}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{new Date(w.created_at).toLocaleDateString('ru-RU')}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap',fontWeight:500}}>{
                    w.items && Array.isArray(w.items)
                      ? w.items.map(function(item) { return item.product_name }).join(', ')
                      : w.product_name
                  }</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{
                    w.items && Array.isArray(w.items)
                      ? w.items.map(function(item) {
                          return Object.entries(item.colors || {}).filter(function(e) { return e[1] > 0 }).map(function(e) { return e[0] + ' ×' + e[1] }).join(', ')
                        }).join('; ')
                      : w.colors && typeof w.colors === 'object'
                        ? Object.entries(w.colors).filter(function(e) { return e[1] > 0 }).map(function(e) { return e[0] }).join(', ')
                        : (w.color || '—')
                  }</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{
                    w.items && Array.isArray(w.items)
                      ? w.items.reduce(function(s, item) { return s + Object.values(item.colors || {}).reduce(function(ss, v) { return ss + v }, 0) }, 0)
                      : w.colors && typeof w.colors === 'object'
                        ? Object.values(w.colors).reduce(function(s, v) { return s + v }, 0)
                        : (w.qty || 0)
                  }</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>
                    {w.reason === 'sale' ? t('saleReason') : w.reason === 'error' ? t('errorReason') : w.reason === 'damage' ? t('damageReason') : w.reason === 'other' ? t('otherReason') : w.reason}
                  </td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{w.client_name || '—'}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{w.client_phone || '—'}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap'}}>{w.price ? Number(w.price).toLocaleString('ru-RU') + ' ₽' : '—'}</td>
                  <td style={{padding:'12px 16px',whiteSpace:'nowrap',color:'#888'}}>{w.comment || '—'}</td>
                  <td>
                    <button className="admin-btn admin-btn-danger" onClick={async () => {
                      if (!confirm('Удалить списание?')) return
                      await fetch(`${API}/api/writeoffs/${w.id}`, {method:'DELETE'})
                      setWriteoffs(prev => prev.filter(x => x.id !== w.id))
                    }} style={{padding:'5px 10px',fontSize:12}}>✕</button>
                  </td>
                </tr>
              ))}
              {writeoffs.length===0 && <tr><td colSpan={11} style={{textAlign:'center',color:'#666',padding:40}}>{t('noWriteoffs')}</td></tr>}
            </tbody>
          </table>
          </div>
          </div>
          </div>
          </div>
        </>)}

        {/* === EDIT PRODUCT MODAL === */}
      {editingProduct && (
        <div className="modal-overlay" onClick={closeEditProduct}>
          <div className="modal modal-wide v2-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header v2-header" style={{borderRadius:'14px 14px 0 0'}}>
              <h3>Редактировать товар</h3>
              <button className="modal-close" onClick={closeEditProduct} style={{color:'#fff'}}>×</button>
            </div>
            <div style={{padding:24,background:'#f8f9ff',display:'flex',flexDirection:'column'}}>

              <div className="v2-st">Основное</div>
              <div className="v2-card">
                <div className="v2-field full-w">
                  <label>Название *</label>
                  <input className="v2-input" placeholder={lang === 'zh' ? '名称 *' : 'Название *'} value={lang === 'zh' ? (editForm.name_zh || editForm.name_ru) : (editForm.name_ru || editForm.name_zh)} onChange={e => {
                    const val = e.target.value
                    if (lang === 'zh') { setEditForm(prev => ({...prev, name_zh: val})) }
                    else { setEditForm(prev => ({...prev, name_ru: val})) }
                  }} required />
                </div>
                <div className="v2-row2">
                  <div className="v2-field half">
                    <label>Розничная цена *</label>
                    <input className="v2-input" type="number" value={editForm.price} onChange={e => setEditForm({...editForm, price: e.target.value})} required />
                  </div>
                  <div className="v2-field half">
                    <label>Оптовая цена</label>
                    <input className="v2-input" type="number" value={editForm.wholesale_price} onChange={e => setEditForm({...editForm, wholesale_price: e.target.value})} />
                  </div>
                </div>
                <div className="v2-field">
                  <label>Тип</label>
                  <select className="v2-input" value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value})}>
                    <option value="scooter">Скутер</option>
                    <option value="enduro">Эндуро</option>
                  </select>
                </div>
              </div>

              <div className="v2-st">Характеристики</div>
              <div className="v2-card">
                <div className="v2-row2">
                  <div className="v2-field half">
                    <label>{t('power')}</label>
                    <select className="v2-input" value={editForm.power} onChange={e => setEditForm({...editForm, power: e.target.value})}>
                      <option value="">{t('power')}</option>
                      <option value="125 / 49">125 / 49</option>
                      <option value="150 / 49">150 / 49</option>
                      <option value="180 / 49">180 / 49</option>
                      <option value="300">300</option>
                    </select>
                  </div>
                  <div className="v2-field half">
                    <label>{t('fuel')}</label>
                    <select className="v2-input" value={editForm.fuel} onChange={e => setEditForm({...editForm, fuel: e.target.value})}>
                      <option value="">{t('fuel')}</option>
                      <option value="Карбюратор">{t('carburetor')}</option>
                      <option value="Инжектор">{t('injector')}</option>
                    </select>
                  </div>
                </div>
                <div className="v2-row3">
                  <div className="v2-field third">
                    <label>{t('cooling')}</label>
                    <select className="v2-input" value={editForm.cooling} onChange={e => setEditForm({...editForm, cooling: e.target.value})}>
                      <option value="">{t('cooling')}</option>
                      <option value="Воздушное">{t('airCooled')}</option>
                      <option value="Жидкостное">{t('liquidCooled')}</option>
                      <option value="Масляное">Масляное</option>
                    </select>
                  </div>
                  <div className="v2-field third">
                    <label>{t('max_speed')}</label>
                    <select className="v2-input" value={editForm.max_speed} onChange={e => setEditForm({...editForm, max_speed: e.target.value})}>
                      <option value="">{t('max_speed')}</option>
                      <option value="95">95</option>
                      <option value="100">100</option>
                      <option value="105">105</option>
                      <option value="110">110</option>
                      <option value="120">120</option>
                    </select>
                  </div>
                  <div className="v2-field third">
                    <label>{t('wheels')}</label>
                    <select className="v2-input" value={editForm.wheels} onChange={e => setEditForm({...editForm, wheels: e.target.value})}>
                      <option value="">{t('wheels')}</option>
                      <option value="10/10">10/10</option>
                      <option value="12/12">12/12</option>
                      <option value="13/13">13/13</option>
                      <option value="13/14">13/14</option>
                      <option value="14/14">14/14</option>
                      <option value="21/18">21/18</option>
                    </select>
                  </div>
                </div>
                <div className="v2-field half">
                  <label>Вес (кг)</label>
                  <input className="v2-input" type="number" value={editForm.weight} onChange={e => setEditForm({...editForm, weight: e.target.value})} />
                </div>
                <div className="v2-row3">
                  <div className="v2-field third">
                    <label>Длина (см)</label>
                    <input className="v2-input" type="number" value={editForm.length} onChange={e => setEditForm({...editForm, length: e.target.value})} />
                  </div>
                  <div className="v2-field third">
                    <label>Ширина (см)</label>
                    <input className="v2-input" type="number" value={editForm.width} onChange={e => setEditForm({...editForm, width: e.target.value})} />
                  </div>
                  <div className="v2-field third">
                    <label>Высота (см)</label>
                    <input className="v2-input" type="number" value={editForm.height} onChange={e => setEditForm({...editForm, height: e.target.value})} />
                  </div>
                </div>
                <div className="v2-field full-w">
                  <label>Описание</label>
                  <textarea className="v2-input" style={{resize:'vertical',minHeight:60}} placeholder={lang === 'zh' ? '描述' : 'Описание'} value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
                </div>
              </div>

              <div className="v2-st">Фото</div>
              <div className="v2-card">
                <div style={{border:'2px dashed #e0e7ff',borderRadius:12,padding:30,textAlign:'center',color:'#667eea',fontSize:13}}>
                  <label style={{cursor:'pointer'}}>
                    Загрузить фото
                    <input type="file" accept="image/*" multiple onChange={handleEditPhotos} hidden />
                  </label>
                  {editPhotos.length > 0 && (
                    <div className="photo-previews" style={{display:'flex',gap:10,marginTop:12,flexWrap:'wrap',justifyContent:'center'}}>
                      {editPhotos.map((p, i) => (
                        <div key={i} className="photo-preview" style={{width:80,height:80,borderRadius:12,overflow:'hidden',position:'relative'}}>
                          <img src={p.url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                          <button type="button" className="photo-remove" onClick={() => removeEditPhoto(i)}>&times;</button>
                          <div className="photo-order" style={{position:'absolute',bottom:2,left:2,background:'rgba(0,0,0,0.5)',color:'#fff',fontSize:10,padding:'1px 6px',borderRadius:4}}>{i + 1}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
            <div className="modal-actions" style={{paddingTop:16}}>
              <button type="button" className="v2-btn v2-btn-cancel" onClick={closeEditProduct}>{t('cancelText')}</button>
              <button type="button" className="v2-btn v2-btn-primary" onClick={updateProduct}>Сохранить</button>
            </div>
            </div>
        </div>
      )}

        {/* === CREATE SHIPMENT MODAL === */}
      {showShipModal && (
        <div className="modal-overlay" onClick={closeShipModal}>
          <div className="modal modal-wide v2-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header v2-header">
              <h3>{shipOrder ? `${t('shipmentFromOrder')} #${shipOrderNum}` : t('newShipment')}</h3>
              <div className="v2-header-right">
                <span className="v2-date-badge">{shipForm.date ? shipForm.date.split("-").reverse().join(".") : ""}</span>
                <button className="modal-close" onClick={closeShipModal} style={{color:'#fff'}}>×</button>
              </div>
            </div>
            <div className="modal-body v2-body">
              <div className="v2-section-title">Клиент</div>
              <div className="v2-client-card">
                <div className="v2-client-row">
                  <div className="v2-client-field">
                    <span className="v2-field-label">Имя</span>
                    <input className="v2-input" placeholder="Имя *" value={shipForm.client.name}
                      onChange={e => setShipForm(prev => ({...prev, client: {...prev.client, name: e.target.value}}))} />
                  </div>
                  <div className="v2-client-field">
                    <span className="v2-field-label">Телефон</span>
                    <input className="v2-input" placeholder={t('phone')} value={shipForm.client.phone}
                      onChange={e => setShipForm(prev => ({...prev, client: {...prev.client, phone: e.target.value}}))} />
                  </div>
                </div>
                <div className="v2-client-row">
                  <div className="v2-client-field">
                    <span className="v2-field-label">Город</span>
                    <input className="v2-input" placeholder="Город" value={shipForm.client.city}
                      onChange={e => setShipForm(prev => ({...prev, client: {...prev.client, city: e.target.value}}))} />
                  </div>
                  <div className="v2-client-field">
                    <span className="v2-field-label">Транспортная</span>
                    <input className="v2-input" placeholder="Транспортная компания" value={shipForm.client.transport}
                      onChange={e => setShipForm(prev => ({...prev, client: {...prev.client, transport: e.target.value}}))} />
                  </div>
                </div>
              </div>

              <div className="v2-section-title">Товары</div>
              <div className="v2-items-list">
                {shipForm.items.map((item, idx) => {
                  const prod = products.find(p => p.id === item.product_id)
                  const availColors = prod?.available_colors || {}
                  const availQty = item.color ? (availColors[item.color] || 0) : 0
                  return (
                    <div key={idx} className="v2-item-card">
                      <div className="v2-item-row">
                        <div className="v2-item-name" style={{flex:1}}>
                          <select className="v2-select-product" value={item.product_id}
                            onChange={e => onProductSelect(idx, e.target.value)}>
                            <option value="0">— Выберите товар —</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name} — {(p.price||0).toLocaleString('ru-RU')} ₽</option>
                            ))}
                          </select>
                        </div>
                        <button className="v2-item-remove" onClick={() => removeShipItem(idx)}>×</button>
                      </div>
                      <div className="v2-item-row">
                        <div className="v2-item-extra" style={{flex:1}}>
                          <select className="v2-select-color" value={item.color}
                            onChange={e => updateShipItem(idx, 'color', e.target.value)}
                            style={{flex:1}}>
                            <option value="">{t('colorLabel')}</option>
                            {Object.entries(availColors).filter(([,qty]) => qty > 0).map(([color, qty]) => (
                              <option key={color} value={color}>
                                {color} — {qty} {t('pcs')}
                              </option>
                            ))}
                          </select>
                        </div>
                        {item.color && (
                          <span className="v2-stock-badge" style={{
                            fontSize:'.7rem', color: availQty > 0 ? '#16a34a' : '#dc2626',
                            whiteSpace:'nowrap', marginLeft:6
                          }}>
                            {availQty > 0 ? '✓ ' + availQty + ' ' + t('pcs') : '✗ нет'}
                          </span>
                        )}
                      </div>
                      <div className="v2-item-row">
                        <div className="v2-item-controls" style={{flex:1,display:'flex',alignItems:'center',gap:6}}>
                          <button className="stock-qty-btn" onClick={() => updateShipItem(idx, 'qty', Math.max(0, item.qty - 1))}>−</button>
                          <input className="v2-input-qty" type="number" min="0" max={availQty > 0 ? availQty : undefined}
                            value={item.qty}
                            onChange={e => {
                              const v = Number(e.target.value)
                              const max = availQty > 0 ? availQty : Infinity
                              updateShipItem(idx, 'qty', Math.min(Math.max(0, v), max))
                            }}
                            style={{width:46,textAlign:'center',padding:'.3rem .25rem',fontSize:'.78rem',border:'1.5px solid var(--border)',borderRadius:'8px',outline:'none',fontFamily:'var(--font)'}} />
                          <button className="stock-qty-btn" onClick={() => {
                            const max = availQty > 0 ? availQty : Infinity
                            updateShipItem(idx, 'qty', Math.min(max, item.qty + 1))
                          }}>+</button>
                          <span className="v2-item-sum" style={{marginLeft:'auto',fontSize:'.82rem',fontWeight:600,color:'#222',whiteSpace:'nowrap'}}>{(item.subtotal||0).toLocaleString('ru-RU')} ₽</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <button className="v2-add-btn" onClick={addShipItem}>+ Добавить товар</button>

              <div className="v2-section-title" style={{marginTop:24}}>Оплата</div>
              <div className="v2-payment">
                <div className="v2-pay-field">
                  <span className="v2-field-label">Полная оплата</span>
                  <input className="v2-input-pay" type="number" min="0" value={shipForm.paid}
                    onChange={e => setShipForm(prev => ({...prev, paid: e.target.value}))} />
                  <span className="v2-pay-currency">₽</span>
                </div>
                <div className="v2-pay-field">
                  <span className="v2-field-label">Предоплата</span>
                  <input className="v2-input-pay" type="number" min="0" value={shipForm.prepaid}
                    onChange={e => setShipForm(prev => ({...prev, prepaid: e.target.value}))} />
                  <span className="v2-pay-currency">₽</span>
                </div>
              </div>

              <div className="v2-total">
                <span>{t('totalLabel')}</span>
                <span>{shipTotal().toLocaleString('ru-RU')} ₽</span>
              </div>

              <div className="v2-footer">
                <button className="v2-btn v2-btn-cancel" onClick={closeShipModal}>{t('cancelText')}</button>
                <button className="v2-btn v2-btn-primary" onClick={createShipment}>Создать отгрузку</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === SHIP PAYMENT MODAL === */}
      {showShipPayModal && shipShipment && (
        <div className="modal-overlay" onClick={() => { setShowShipPayModal(false); setShipShipment(null) }}>
          <div className="modal modal-compact" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Отгрузить — {shipShipment.number}</h3>
              <button className="modal-close" onClick={() => { setShowShipPayModal(false); setShipShipment(null) }}>×</button>
            </div>
            <div className="modal-body">
              <div style={{marginBottom:16}}>
                <div style={{fontSize:13,color:'#666',marginBottom:4}}>Сумма заказа</div>
                <div style={{fontSize:18,fontWeight:700,color:'#222'}}>{(shipShipment.total||0).toLocaleString('ru-RU')} ₽</div>
              </div>
              {shipShipment.prepaid > 0 && (
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:13,color:'#666',marginBottom:4}}>Уже оплачено (предоплата)</div>
                  <div style={{fontSize:16,fontWeight:600,color:'#333'}}>{(shipShipment.prepaid||0).toLocaleString('ru-RU')} ₽</div>
                </div>
              )}
              <div style={{marginBottom:20}}>
                <label style={{display:'block',fontSize:13,color:'#666',marginBottom:6,fontWeight:500}}>Сумма оплаты при отгрузке</label>
                <div style={{display:'flex',gap:8,alignItems:'center',background:'#f5f5f5',borderRadius:10,padding:'8px 12px'}}>
                  <input type="number" min="0" placeholder="0" value={shipPayAmount}
                    onChange={e => setShipPayAmount(e.target.value)}
                    style={{flex:1,background:'transparent',border:'none',outline:'none',fontSize:16,fontWeight:600,color:'#222'}} />
                  <span style={{fontSize:14,color:'#888',fontWeight:500}}>₽</span>
                </div>
              </div>
              <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                <button className="v2-btn v2-btn-cancel" onClick={() => { setShowShipPayModal(false); setShipShipment(null) }}>Отмена</button>
                <button className="v2-btn v2-btn-primary" onClick={confirmShipPayment}>Отгрузить</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === RECEIVE STOCK MODAL === */}
      {showReceiveModal && receiveStockEntry && (
        <div className="modal-overlay" onClick={closeReceiveModal}>
          <div className="modal modal-compact" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('receiveStock')} — {receiveStockEntry.product_name}</h3>
              <button className="modal-close" onClick={closeReceiveModal}>×</button>
            </div>
            <div className="modal-body">
              {Object.entries(receiveStockEntry.colors || {}).filter(([,v]) => v > 0).map(([color, maxQty]) => {
                const selected = color in receiveColors
                const qty = receiveColors[color] || 0
                return (
                  <div key={color} className="receive-color-row">
                    <label className="receive-color-label">
                      <span className={`receive-toggle ${selected ? 'active' : ''}`}
                        onClick={() => toggleReceiveColor(color)}>
                        <span className="receive-toggle-knob" />
                      </span>
                      <span className={`receive-color-swatch ${getColorHex(color) === 'chameleon' ? 'color-swatch-chameleon' : ''}`}
                        style={getColorHex(color) !== 'chameleon' ? {background: getColorHex(color)} : {}} />
                      <span style={{marginLeft:8}}>{color}</span>
                    </label>
                    {selected && (
                      <div className="receive-qty-control">
                        <button type="button" className="stock-qty-btn"
                          onClick={() => updateReceiveColorQty(color, -1)}>−</button>
                        <span className="stock-qty">{qty}</span>
                        <button type="button" className="stock-qty-btn"
                          onClick={() => updateReceiveColorQty(color, 1)}>+</button>
                        <span style={{color:'#999',fontSize:12,marginLeft:8}}>/ {maxQty}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="modal-actions">
              <button className="v2-btn v2-btn-cancel" onClick={closeReceiveModal}>{t('cancel')}</button>
              <button className="v2-btn v2-btn-primary" onClick={submitReceive}
                disabled={Object.keys(receiveColors).filter(k => receiveColors[k] > 0).length === 0}>
                {t('receiveConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === INVOICE MODAL === */}
      {invoiceShip && (
        <div className="modal-overlay" onClick={() => setInvoiceShip(null)}>
          <div className="modal modal-wide invoice-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('invoice')} {invoiceShip.number}</h3>
              <div>
                <button className="admin-btn admin-btn-print" onClick={() => window.print()}>{t('print')}</button>
                <button className="modal-close" onClick={() => setInvoiceShip(null)}>×</button>
              </div>
            </div>
            <div className="invoice-body" id="invoice-content">
              <div className="invoice-header">
                <div className="invoice-brand">
                  <h1>OUDA</h1>
                  <p>Скутеры оптом и в розницу</p>
                </div>
                <div className="invoice-meta">
                  <div className="invoice-number">{invoiceShip.number}</div>
                  <div className="invoice-date">от {new Date(invoiceShip.created_at).toLocaleDateString('ru-RU')}</div>
                </div>
              </div>

              <div className="invoice-client">
                <h4>{t('consignee')}:</h4>
                <p><strong>{invoiceShip.client?.name || '—'}</strong></p>
                <p>{t('phoneLabel')}: {invoiceShip.client?.phone || '—'}</p>
                <p>Город: {invoiceShip.client?.city || '—'}</p>
                {invoiceShip.pickup ? <><p>Самовывоз (Москва)</p>{invoiceShip.pickup_date ? <p>Дата самовывоза: {invoiceShip.pickup_date}{invoiceShip.pickup_time ? ' ' + invoiceShip.pickup_time : ''}</p> : ''}</> : invoiceShip.client?.transport && <p>Транспортная компания: {invoiceShip.client.transport}</p>}
              </div>

              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>№</th><th>{t('product')}</th><th>{t('color')}</th><th>{t('qty')}</th><th>{t('unitPrice')}</th><th>{t('sum')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoiceShip.items || []).map((item, i) => (
                    <tr key={i}>
                      <td>{i+1}</td>
                      <td>{item.product_name}</td>
                      <td>{translateColor(item.color) || '—'}</td>
                      <td>{item.qty}</td>
                      <td>{(item.price||0).toLocaleString('ru-RU')} ₽</td>
                      <td>{(item.subtotal||0).toLocaleString('ru-RU')} ₽</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="invoice-summary">
                {invoiceShip.assembly ? (
                  <div className="invoice-paid">
                    <span>🔧 Сборка {invoiceShip.assembly}: </span>
                    <span>+{Number(invoiceShip.assembly_total || 0).toLocaleString('ru-RU')} ₽</span>
                  </div>
                ) : ''}
                <div className="invoice-total">
                  <span>{t('totalDue')}: </span>
                  <span className="invoice-total-amount">{(invoiceShip.total||0).toLocaleString('ru-RU')} ₽</span>
                </div>
                {invoiceShip.prepaid > 0 && (
                  <div className="invoice-paid">
                    <span>Предоплата: </span>
                    <span>{(invoiceShip.prepaid||0).toLocaleString('ru-RU')} ₽</span>
                  </div>
                )}
                {invoiceShip.paid > 0 && invoiceShip.paid >= invoiceShip.total
                  ? <div className="invoice-paid" style={{color:'#22c55e',fontWeight:700}}>
                      <span style={{color:'#333'}}>Оплачено полностью</span>
                    </div>
                  : <div className="invoice-paid">
                      <span>К оплате: </span>
                      <span>{((invoiceShip.total||0) - Math.max(invoiceShip.paid||0, invoiceShip.prepaid||0)).toLocaleString('ru-RU')} ₽</span>
                    </div>
                }
                {invoiceShip.status === 'доставлено' && (
                  <div className="invoice-status-badge">Доставлено</div>
                )}
              </div>

              <div className="invoice-footer">
                <p>Телефон: +7(900)000-80-23</p>
                <p>OUDA — интернет-магазин скутеров</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: форма агента */}
      {agentModalOpen && (
        <div className="modal-overlay" onClick={() => setAgentModalOpen(false)}>
          <div className="modal-box" style={{maxWidth:480}} onClick={e => e.stopPropagation()}>
            <h3 style={{marginBottom:16}}>{agentForm.id ? 'Редактировать агента' : 'Новый агент'}</h3>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <input className="v2-input" placeholder="Имя *" value={agentForm.name} onChange={e => setAgentForm({...agentForm, name: e.target.value})} />
              <input className="v2-input" placeholder="Код ссылки (можно оставить пустым — создастся сам из имени)" value={agentForm.code} onChange={e => setAgentForm({...agentForm, code: e.target.value})} />
              <input className="v2-input" placeholder="WhatsApp ссылка (https://wa.me/...)" value={agentForm.wa_link} onChange={e => setAgentForm({...agentForm, wa_link: e.target.value})} />
              <input className="v2-input" placeholder="Telegram ссылка (https://t.me/...)" value={agentForm.tg_link} onChange={e => setAgentForm({...agentForm, tg_link: e.target.value})} />
              <input className="v2-input" placeholder="MAX ссылка (https://max.ru/u/...)" value={agentForm.max_link} onChange={e => setAgentForm({...agentForm, max_link: e.target.value})} />
              <input className="v2-input" placeholder="Телефон (необязательно)" value={agentForm.phone} onChange={e => setAgentForm({...agentForm, phone: e.target.value})} />
              <div style={{fontSize:11,color:'#888'}}>Пустые мессенджеры скрываются на сайте для клиентов агента.</div>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
              <button className="color-modal-cancel" onClick={() => setAgentModalOpen(false)}>Отмена</button>
              <button className="product-add" onClick={saveAgent}>{agentForm.id ? 'Сохранить' : 'Создать'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: добавить клиента агенту */}
      {clientModal && (
        <div className="modal-overlay" onClick={() => setClientModal(null)}>
          <div className="modal-box" style={{maxWidth:440}} onClick={e => e.stopPropagation()}>
            <h3 style={{marginBottom:16}}>Новый клиент для агента {clientModal.name}</h3>
            <form onSubmit={addAgentClient} style={{display:'flex',flexDirection:'column',gap:10}}>
              <input className="v2-input" placeholder="Имя *" value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value})} required />
              <input className="v2-input" placeholder="Телефон" value={clientForm.phone} onChange={e => setClientForm({...clientForm, phone: e.target.value})} />
              <input className="v2-input" placeholder="Город" value={clientForm.city} onChange={e => setClientForm({...clientForm, city: e.target.value})} />
              <input className="v2-input" placeholder="Заметка" value={clientForm.note} onChange={e => setClientForm({...clientForm, note: e.target.value})} />
              <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}>
                <button type="button" className="color-modal-cancel" onClick={() => setClientModal(null)}>Отмена</button>
                <button type="submit" className="product-add">Добавить</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
