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
  const [tab, setTab] = useState('orders')
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [stock, setStock] = useState([])
  const [shipments, setShipments] = useState([])

  // Create shipment modal
  const [showShipModal, setShowShipModal] = useState(false)
  const [shipOrder, setShipOrder] = useState(null)
  const [shipForm, setShipForm] = useState({ client: { name: '', phone: '', city: '', transport: '' }, items: [], prepaid: 0, paid: 0 })

  // Invoice modal
  const [invoiceShip, setInvoiceShip] = useState(null)

  // New product form
  const [newProduct, setNewProduct] = useState({
    name_ru: '', name_zh: '', price: '', wholesale_price: '', power: '', fuel: '', cooling: '', max_speed: '', wheels: '', description: '', images: []
  })
  const [photos, setPhotos] = useState([]) // file previews
  const [uploading, setUploading] = useState(false)
  // Edit product modal
  const [editingProduct, setEditingProduct] = useState(null)
  const [editForm, setEditForm] = useState({ name_ru: '', name_zh: '', price: '', wholesale_price: '', power: '', fuel: '', cooling: '', max_speed: '', wheels: '', description: '' })
  const [editPhotos, setEditPhotos] = useState([])
  const [uploadingEdit, setUploadingEdit] = useState(false)
  const [editDragIdx, setEditDragIdx] = useState(null)

  const openEditProduct = (p) => {
    setEditForm({
      name_ru: p.name_ru || '',
      name_zh: p.name_zh || '',
      price: p.price || '',
      wholesale_price: p.wholesale_price || '',
      power: p.power || '',
      fuel: p.fuel || '',
      cooling: p.cooling || '',
      max_speed: p.max_speed || '',
      wheels: p.wheels || '',
      description: p.description || '',
    })
    const existing = (p.images || []).map(url => ({ file: null, url }))
    setEditPhotos(existing)
    setEditingProduct(p)
  }

  const closeEditProduct = () => { setEditingProduct(null); setEditPhotos([]); setEditDragIdx(null) }

  const handleEditPhotos = (e, files) => {
    const fileList = files || Array.from(e?.target?.files || [])
    const total = editPhotos.length + fileList.length
    if (total > 7) { alert(t('maxPhotos')); return }
    const newPhotos = fileList.map(f => ({ file: f, url: URL.createObjectURL(f) }))
    setEditPhotos(prev => [...prev, ...newPhotos])
    if (e?.target) e.target.value = ''
  }

  const removeEditPhoto = (idx) => {
    setEditPhotos(prev => { URL.revokeObjectURL(prev[idx].url); return prev.filter((_, i) => i !== idx) })
  }

  const handleEditDragStart = (idx) => { setEditDragIdx(idx) }
  const handleEditDragOver = (e) => { e.preventDefault() }
  const handleEditDrop = (idx) => {
    if (editDragIdx === null || editDragIdx === idx) { setEditDragIdx(null); return }
    setEditPhotos(prev => {
      const next = [...prev]
      const [moved] = next.splice(editDragIdx, 1)
      next.splice(idx, 0, moved)
      return next
    })
    setEditDragIdx(null)
  }

  const handleEditDropFiles = (e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length > 0) handleEditPhotos(null, files)
  }

  const updateProduct = async (e) => {
    e.preventDefault()
    if (!editingProduct) return

    // Upload new photos
    let images = []
    const newFiles = editPhotos.filter(p => p.file)
    if (newFiles.length > 0) {
      setUploadingEdit(true)
      const formData = new FormData()
      newFiles.forEach(p => formData.append('photos', p.file))
      try {
        const resp = await fetch(`${API}/api/upload`, { method: 'POST', body: formData })
        const data = await resp.json()
        images = data.urls || []
      } catch (e) { console.error('Upload failed', e) }
      setUploadingEdit(false)
    }

    // Final image list: existing (without file) + newly uploaded
    const existingUrls = editPhotos.filter(p => !p.file).map(p => p.url)
    const allImages = [...existingUrls, ...images]

    const updated = {
      ...editForm,
      price: Number(editForm.price) || 0,
      wholesale_price: Number(editForm.wholesale_price) || 0,
      images: allImages,
      image: allImages[0] || '',
      name: lang === 'zh' ? (editForm.name_zh || editForm.name_ru) : (editForm.name_ru || editForm.name_zh),
    }
    fetch(`${API}/api/products/${editingProduct.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {
      const list = getLocal(LS_PRODUCTS).map(p => p.id === editingProduct.id ? { ...p, ...updated } : p)
      setLocal(LS_PRODUCTS, list)
      setProducts(list)
    })
    setEditingProduct(null)
    setEditPhotos([])
    setEditDragIdx(null)
    setTimeout(loadData, 300)
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
    fetch(`${API}/api/orders`).then(r => r.json()).then(setOrders).catch(() => setOrders(getLocal(LS_ORDERS)))
    fetch(`${API}/api/products`).then(r => r.json()).then(setProducts).catch(() => setProducts(getLocal(LS_PRODUCTS)))
    fetch(`${API}/api/stock`).then(r => r.json()).then(setStock).catch(() => setStock(getLocal(LS_STOCK)))
    fetch(`${API}/api/shipments`).then(r => r.json()).then(setShipments).catch(() => setShipments(getLocal(LS_SHIPMENTS)))
    fetch(`${API}/api/stock/details`).then(r => r.json()).then(setInventory).catch(() => {})
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

  const openShipFromOrder = (order) => {
    const items = (order.items || []).map(item => ({
      product_id: item.product_id,
      product_name: item.name,
      color: item.color || '',
      price: item.price || 0,
      qty: 0,
      subtotal: 0,
    }))
    setShipOrder(order)
    setShipForm({
      client: { name: order.name, phone: order.phone, city: order.city || '', transport: '' },
      items, prepaid: 0, paid: 0,
    })
    setShowShipModal(true)
  }

  const openShipManual = () => {
    setShipOrder(null)
    setShipForm({ client: { name: '', phone: '', city: '', transport: '' }, items: [{ product_id: 0, product_name: '', color: '', price: 0, qty: 0, subtotal: 0 }], prepaid: 0, paid: 0 })
    setShowShipModal(true)
  }

  const closeShipModal = () => { setShowShipModal(false); setShipOrder(null) }

  const updateShipItem = (idx, field, value) => {
    setShipForm(prev => {
      const items = [...prev.items]
      items[idx] = { ...items[idx], [field]: value }
      items[idx].subtotal = (items[idx].price || 0) * (items[idx].qty || 0)
      return { ...prev, items }
    })
  }

  const addShipItem = () => {
    setShipForm(prev => ({
      ...prev,
      items: [...prev.items, { product_id: 0, product_name: '', color: '', price: 0, qty: 0, subtotal: 0 }]
    }))
  }

  const removeShipItem = (idx) => {
    setShipForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))
  }

  const onProductSelect = (idx, productId) => {
    const pid = Number(productId)
    const prod = products.find(p => p.id === pid)
    if (!prod) return
    setShipForm(prev => {
      const items = [...prev.items]
      items[idx] = {
        ...items[idx], product_id: pid, product_name: prod.name,
        price: prod.price, color: prod.colors?.[0]?.name || '',
        qty: 1, subtotal: prod.price,
      }
      return { ...prev, items }
    })
  }

  const shipTotal = () => shipForm.items.reduce((s, i) => s + i.subtotal, 0)

  const createShipment = () => {
    const items = shipForm.items.filter(i => i.qty > 0 && i.product_id > 0)
    if (items.length === 0) return
    const payload = {
      order_id: shipOrder?.id || null,
      client: shipForm.client,
      items,
      total: items.reduce((s, i) => s + i.subtotal, 0),
      prepaid: Number(shipForm.prepaid) || 0,
      paid: Number(shipForm.paid) || 0,
    }
    fetch(`${API}/api/shipments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }).catch(() => {
      const list = getLocal(LS_SHIPMENTS)
      list.push({ id: Date.now(), number: 'OUDA-' + String(list.length + 1).padStart(3, '0'), ...payload, status: 'оформлено', created_at: new Date().toISOString() })
      setLocal(LS_SHIPMENTS, list)
    })
    setShowShipModal(false)
    setShipOrder(null)
    setTimeout(loadData, 300)
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

  // Drag state for photo reorder
  const [dragIdx, setDragIdx] = useState(null)

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

  const handleDragStart = (idx) => { setDragIdx(idx) }
  const handleDragOver = (e) => { e.preventDefault() }
  const handleDrop = (idx) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); return }
    setPhotos(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx, 1)
      next.splice(idx, 0, moved)
      return next
    })
    setDragIdx(null)
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

    const product = { ...newProduct, price: basePrice, wholesale_price: wholesalePrice, name: lang === 'zh' ? (newProduct.name_zh || newProduct.name_ru) : (newProduct.name_ru || newProduct.name_zh), images, image: images[0] || '', id: Date.now() }
    fetch(`${API}/api/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product) })
      .catch(() => { const list = getLocal(LS_PRODUCTS); list.push(product); setLocal(LS_PRODUCTS, list) })
    setNewProduct({ name_ru: '', name_zh: '', price: '', wholesale_price: '', power: '', fuel: '', cooling: '', max_speed: '', wheels: '', description: '', images: [] })
    setPhotos([])
    setTimeout(loadData, 300)
  }

  const deleteProduct = (id) => {
    fetch(`${API}/api/products/${id}`, { method: 'DELETE' })
      .catch(() => { const list = getLocal(LS_PRODUCTS).filter(p => p.id !== id); setLocal(LS_PRODUCTS, list); setProducts(list) })
    setTimeout(loadData, 300)
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

  const statusLabel = (s) => { const map = { new: t('new'), accepted: t('accepted'), done: t('completed') }; return map[s] || s }
  const statusClass = (s) => { const map = { new: 'status-new', accepted: 'status-accepted', done: 'status-done' }; return map[s] || '' }
  const logout = () => { sessionStorage.removeItem('ouda_admin'); navigate('/login') }

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
            { key: 'products', label: `${t('products')} (${products.length})` },
            { key: 'stock', label: `${t('stock')}` },
            { key: 'inventory', label: t('inventory') },
            { key: 'orders', label: `${t('orders')} (${orders.length})` },
            { key: 'shipments', label: `${t('shipments')} (${shipments.length})` },
          ].map(tabItem => (
            <button key={tabItem.key} className={`admin-tab ${tab === tabItem.key ? 'active' : ''}`}
              onClick={() => setTab(tabItem.key)}>{tabItem.label}</button>
          ))}
        </div>

        {/* === PRODUCTS TAB === */}
        {tab === 'products' && (<>
          <form className="admin-add-form" onSubmit={addProduct}>
            <h3>{t('addProduct')}</h3>
            <div className="form-grid">
              <input placeholder={lang === 'zh' ? '名称 *' : 'Название *'} value={lang === 'zh' ? (newProduct.name_zh || newProduct.name_ru) : (newProduct.name_ru || newProduct.name_zh)} onChange={e => {
                const val = e.target.value
                if (lang === 'zh') {
                  setNewProduct(prev => ({...prev, name_zh: val}))
                } else {
                  setNewProduct(prev => ({...prev, name_ru: val}))
                }
              }} required />
              <input placeholder="Розничная цена *" type="number" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} required />
              <input placeholder="Оптовая цена *" type="number" value={newProduct.wholesale_price} onChange={e => setNewProduct({...newProduct, wholesale_price: e.target.value})} required />
              <input placeholder={t('power')} value={newProduct.power} onChange={e => setNewProduct({...newProduct, power: e.target.value})} />
              <input placeholder={t('fuel')} value={newProduct.fuel} onChange={e => setNewProduct({...newProduct, fuel: e.target.value})} />
              <input placeholder={t('cooling')} value={newProduct.cooling} onChange={e => setNewProduct({...newProduct, cooling: e.target.value})} />
              <input placeholder={t('max_speed')} value={newProduct.max_speed} onChange={e => setNewProduct({...newProduct, max_speed: e.target.value})} />
              <input placeholder={t('wheels')} value={newProduct.wheels} onChange={e => setNewProduct({...newProduct, wheels: e.target.value})} />
              <div className="full-width photo-upload-area"
                onDragOver={handleDragOver}
                onDrop={handleDropFiles}
              >
                <label className="photo-upload-label">
                  {uploading ? t('uploading') : t('uploadPhotos')}
                  <input type="file" accept="image/*" multiple onChange={handlePhotos} disabled={uploading} hidden />
                </label>
                {photos.length > 0 && (
                  <div className="photo-previews">
                    {photos.map((p, i) => (
                      <div key={i}
                        className={`photo-preview ${dragIdx === i ? 'dragging' : ''}`}
                        draggable
                        onDragStart={() => handleDragStart(i)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(i)}
                        onDragEnd={() => setDragIdx(null)}
                      >
                        <img src={p.url} alt="" />
                        <button type="button" className="photo-remove" onClick={() => removePhoto(i)}>×</button>
                        <div className="photo-order">{i + 1}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="full-width"><textarea placeholder={lang === 'zh' ? '描述' : 'Описание'} value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} /></div>
              <button type="submit">{t('addProduct')}</button>
            </div>
          </form>
          <div style={{margin:'0 24px 24px'}}>
          <div style={{overflowX:'auto',borderRadius:'var(--radius)'}}>
          <table className="admin-table" style={{margin:0}}>
            <thead><tr>
              <th>{t('nameLabel')}</th><th>Розница</th><th>Опт</th><th>{t('power')}</th><th>{t('fuel')}</th><th>{t('wheels')}</th><th></th>
            </tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} style={{cursor:'pointer'}} onClick={() => openEditProduct(p)}>
                  <td><strong>{lang === 'zh' ? (p.name_zh || p.name) : (p.name_ru || p.name)}</strong></td>
                  <td>{p.price.toLocaleString('ru-RU')} ₽</td>
                  <td>{(p.wholesale_price || p.price).toLocaleString('ru-RU')} ₽</td>
                  <td>{p.power||'—'}</td>
                  <td>{p.fuel||'—'}</td>
                  <td>{p.wheels||'—'}</td>
                  <td><button className="admin-btn admin-btn-done" onClick={(e) => { e.stopPropagation(); deleteProduct(p.id) }} style={{color:'#ef4444'}}>{t('delete')}</button></td>
                </tr>
              ))}
              {products.length===0 && <tr><td colSpan={7} style={{textAlign:'center',color:'#666',padding:40}}>{t('noProducts')}</td></tr>}
            </tbody>
          </table>
          </div>
          </div>
        </>)}

        {/* === STOCK TAB === */}
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
              <button type="submit">{t('addStock')}</button>
            </div>
          </form>
          <div className="stock-list">
            {stock.map(s => (
              <div key={s.id} className="stock-card">
                <div className="stock-card-head">
                  <strong className="stock-card-name">{s.product_name}</strong>
                  <span className={`admin-badge ${s.status==='received'?'badge-received':'badge-transit'}`}>
                    {s.status==='received' ? t('received') : t('inTransit')} {formatShortDate(s.date)}
                  </span>
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
        </>)}
      </div>

      {/* === INVENTORY TAB === */}
        {tab === 'inventory' && (<>
          <div style={{margin:'0 24px 16px'}}>
            <h3 style={{fontSize:15,fontWeight:600}}>Остатки на складе</h3>
          </div>
          {inventory.filter(d => d.totalAvailable > 0 || d.totalReceived > 0).map(d => (
            <div key={d.product_id} className="inventory-card" style={{margin:'0 24px 16px'}}>
              <div className="inv-header">
                <strong>{d.product_name}</strong>
                <span className="inv-total">{t('totalItems')}: <b>{d.totalAvailable}</b> шт</span>
              </div>
              <table className="inv-table">
                <thead><tr>
                  <th>{t('color')}</th><th>{t('received')}</th><th>{t('shippedOut')}</th><th>{t('available')}</th><th></th>
                </tr></thead>
                <tbody>
                  {d.colors.filter(c => c.received > 0 || c.available > 0).map(c => (
                    <tr key={c.color}>
                      <td>
                        <div className="inv-color-cell">
                          <div className={`color-swatch ${getColorHex(c.color) === 'chameleon' ? 'color-swatch-chameleon' : ''}`}
                            style={getColorHex(c.color) !== 'chameleon' ? {background:getColorHex(c.color),width:16,height:16,cursor:'default'} : {width:16,height:16,cursor:'default'}} />
                          <span>{translateColor(c.color)}</span>
                        </div>
                      </td>
                      <td>{c.received}</td>
                      <td>{c.shipped}</td>
                      <td><strong className={c.available === 0 ? 'inv-zero' : 'inv-ok'}>{c.available}</strong></td>
                      <td>
                        {c.available > 0
                          ? <span className="inv-badge">{t('inStock')}</span>
                          : c.received > 0
                            ? <span className="inv-badge inv-badge-out">{t('none')}</span>
                            : <span className="inv-badge inv-badge-none">{t('neverHad')}</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {inventory.filter(d => d.totalAvailable > 0 || d.totalReceived > 0).length === 0 && (
            <p style={{color:'#666',textAlign:'center',padding:40}}>{t('noInventory')}</p>
          )}
        </>)}

        {/* === ORDERS TAB === */}
        {tab === 'orders' && (<>
          <div style={{margin:'0 24px 24px'}}>
          <div style={{overflowX:'auto',borderRadius:'var(--radius)'}}>
          <table className="admin-table" style={{margin:0}}>
            <thead><tr>
              <th>№</th><th>{t('date')}</th><th>{t('name')}</th><th>{t('city')}</th><th>{t('phone')}</th>
              <th>{t('products')}</th><th>{t('total')}</th><th>{t('payment')}</th><th>{t('status')}</th><th></th>
            </tr></thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={o.id}>
                  <td>{i+1}</td>
                  <td style={{fontSize:13,color:'#999'}}>{formatDate(o.created_at)}</td>
                  <td><strong>{o.name}</strong></td>
                  <td>{o.city||'—'}</td>
                  <td>{o.phone}</td>
                  <td style={{fontSize:13}}>{o.items?.map(item => `${item.name} ×${item.qty}`).join(', ')||'—'}</td>
                  <td><strong>{(o.total||0).toLocaleString('ru-RU')} ₽</strong></td>
                  <td><span className="admin-badge">{o.payment==='usdt'?'USDT':t('cash')}</span></td>
                  <td><span className={`status ${statusClass(o.status)}`}>{statusLabel(o.status)}</span></td>
                  <td>
                    <div className="admin-actions">
                      {o.status==='new' && <button className="admin-btn admin-btn-accept" onClick={() => updateStatus(o.id,'accepted')}>{t('accept')}</button>}
                      {o.status!=='done' && <button className="admin-btn admin-btn-done" onClick={() => updateStatus(o.id,'done')}>{t('done')}</button>}
                      <button className="admin-btn admin-btn-ship" onClick={() => openShipFromOrder(o)}>Отгрузить</button>
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length===0 && <tr><td colSpan={10} style={{textAlign:'center',color:'#666',padding:40}}>{t('noOrders')}</td></tr>}
            </tbody>
          </table>
          </div>
          </div>
        </>)}

        {/* === SHIPMENTS TAB === */}
        {tab === 'shipments' && (<>
          <div style={{margin:'0 24px 16px'}}>
            <button style={{padding:'10px 24px',fontSize:13,fontWeight:500,background:'var(--bg-hover)',color:'var(--text)',border:'1px solid #999',borderRadius:50,cursor:'pointer',margin:'0 0 0 auto'}} onClick={openShipManual}>Новая отгрузка</button>
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
                <tr key={s.id}>
                  <td><strong>{s.number}</strong></td>
                  <td style={{fontSize:13,color:'#999'}}>{formatDate(s.created_at)}</td>
                  <td>{s.client?.name || '—'}</td>
                  <td>{s.client?.phone || '—'}</td>
                  <td style={{fontSize:13}}>
                    {(s.items || []).map(item => `${item.product_name}${item.color ? ' ('+item.color+')' : ''} ×${item.qty}`).join(', ')}
                  </td>
                  <td><strong>{(s.total||0).toLocaleString('ru-RU')} ₽</strong></td>
                  <td style={{fontSize:13}}>
                    {s.prepaid > 0 && <div>{t('prepaid')}: {(s.prepaid||0).toLocaleString('ru-RU')} ₽</div>}
                    {s.paid > 0 && <div>{t('fullPayment')}: {(s.paid||0).toLocaleString('ru-RU')} ₽</div>}
                    {!s.prepaid && !s.paid && <span style={{color:'#999'}}>—</span>}
                  </td>
                  <td><span className={`status ${statusShipClass(s.status)}`}>{statusShipLabel(s.status)}</span></td>
                  <td>
                    <div className="admin-actions">
                      {s.status === 'оформлено' && <>
                        <button className="admin-btn admin-btn-accept" onClick={() => updateShipment(s.id,{status:'отгружено'})}>Отгрузить</button>
                        <button className="admin-btn admin-btn-danger" onClick={() => updateShipment(s.id,{status:'отменено'})}>✕ Отмена</button>
                      </>}
                      {s.status === 'отгружено' && <>
                        <button className="admin-btn admin-btn-done" onClick={() => updateShipment(s.id,{status:'доставлено'})}>Доставлено</button>
                      </>}
                      <button className="admin-btn admin-btn-invoice" onClick={() => setInvoiceShip(s)}>Накладная</button>
                    </div>
                  </td>
                </tr>
              ))}
              {shipments.length===0 && <tr><td colSpan={9} style={{textAlign:'center',color:'#666',padding:40}}>{t('noShipments')}</td></tr>}
            </tbody>
          </table>
          </div>
          </div>
        </>)}

        {/* === EDIT PRODUCT MODAL === */}
      {editingProduct && (
        <div className="modal-overlay" onClick={closeEditProduct}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Редактировать товар</h3>
              <button className="modal-close" onClick={closeEditProduct}>×</button>
            </div>
            <div className="admin-add-form" style={{border:'none',boxShadow:'none',margin:0}}>
            <form onSubmit={updateProduct}>
            <div className="form-grid">
                <input placeholder="Название (RU) *" value={editForm.name_ru} onChange={e => setEditForm({...editForm, name_ru: e.target.value})} required />
                <input placeholder="Название (中文)" value={editForm.name_zh} onChange={e => setEditForm({...editForm, name_zh: e.target.value})} />
                <input placeholder="Розничная цена *" type="number" value={editForm.price} onChange={e => setEditForm({...editForm, price: e.target.value})} required />
                <input placeholder="Оптовая цена *" type="number" value={editForm.wholesale_price} onChange={e => setEditForm({...editForm, wholesale_price: e.target.value})} required />
                <input placeholder={t('power')} value={editForm.power} onChange={e => setEditForm({...editForm, power: e.target.value})} />
                <input placeholder={t('fuel')} value={editForm.fuel} onChange={e => setEditForm({...editForm, fuel: e.target.value})} />
                <input placeholder={t('cooling')} value={editForm.cooling} onChange={e => setEditForm({...editForm, cooling: e.target.value})} />
                <input placeholder={t('max_speed')} value={editForm.max_speed} onChange={e => setEditForm({...editForm, max_speed: e.target.value})} />
                <div className="full-width photo-upload-area"
                  onDragOver={handleEditDragOver}
                  onDrop={handleEditDropFiles}
                >
                  <label className="photo-upload-label">
                    {uploadingEdit ? t('uploading') : 'Фото товара'}
                    <input type="file" accept="image/*" multiple onChange={handleEditPhotos} disabled={uploadingEdit} hidden />
                  </label>
                  {editPhotos.length > 0 && (
                    <div className="photo-previews">
                      {editPhotos.map((p, i) => (
                        <div key={i}
                          className={`photo-preview ${editDragIdx === i ? 'dragging' : ''}`}
                          draggable
                          onDragStart={() => handleEditDragStart(i)}
                          onDragOver={handleEditDragOver}
                          onDrop={() => handleEditDrop(i)}
                          onDragEnd={() => setEditDragIdx(null)}
                        >
                          <img src={p.url} alt="" />
                          <button type="button" className="photo-remove" onClick={() => removeEditPhoto(i)}>×</button>
                          <div className="photo-order">{i + 1}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="full-width"><textarea placeholder={lang === 'zh' ? '描述' : 'Описание'} value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} /></div>
              </div>
            <div className="modal-actions" style={{paddingTop:16}}>
              <button type="button" className="admin-btn admin-btn-cancel" onClick={closeEditProduct}>Отмена</button>
              <button type="submit" className="admin-btn-primary">Сохранить</button>
            </div>
            </form>
            </div>
          </div>
        </div>
      )}

        {/* === CREATE SHIPMENT MODAL === */}
      {showShipModal && (
        <div className="modal-overlay" onClick={closeShipModal}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{shipOrder ? `${t('shipmentFromOrder')} #${shipOrder.id}` : t('newShipment')}</h3>
              <button className="modal-close" onClick={closeShipModal}>×</button>
            </div>
            <div className="modal-body">
              <h4 style={{marginBottom:12,fontSize:14,color:'#666'}}>Клиент</h4>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
                <input className="ship-input" placeholder="Имя *" value={shipForm.client.name}
                  onChange={e => setShipForm(prev => ({...prev, client: {...prev.client, name: e.target.value}}))} />
                <input className="ship-input" placeholder={t('phone')} value={shipForm.client.phone}
                  onChange={e => setShipForm(prev => ({...prev, client: {...prev.client, phone: e.target.value}}))} />
                <input className="ship-input" placeholder="Город" value={shipForm.client.city}
                  onChange={e => setShipForm(prev => ({...prev, client: {...prev.client, city: e.target.value}}))} />
                <input className="ship-input" placeholder="Транспортная компания" value={shipForm.client.transport}
                  onChange={e => setShipForm(prev => ({...prev, client: {...prev.client, transport: e.target.value}}))} />
              </div>

              <h4 style={{marginBottom:12,fontSize:14,color:'#666'}}>{t('product')}</h4>
              {shipForm.items.map((item, idx) => (
                <div key={idx} className="ship-item-row">
                  <select className="ship-select" value={item.product_id} onChange={e => onProductSelect(idx, e.target.value)}>
                    <option value="0">{t('selectProductPlaceholder')}</option>
                    {products.filter(p => {
                      const usedInOther = shipForm.items.some((it, i) => i !== idx && it.product_id === p.id)
                      return true // allow same product multiple times (different colors)
                    }).map(p => (
                      <option key={p.id} value={p.id}>{lang === 'zh' ? (p.name_zh || p.name) : (p.name_ru || p.name)} — {p.price.toLocaleString('ru-RU')} ₽</option>
                    ))}
                  </select>
                  {item.product_id > 0 && (
                    <>
                      <select className="ship-select ship-color" value={item.color} onChange={e => updateShipItem(idx, 'color', e.target.value)}>
                        <option value="">Цвет</option>
                        {(products.find(p => p.id === item.product_id)?.available_colors ? Object.entries(products.find(p => p.id === item.product_id).available_colors).filter(([,qty]) => qty > 0).map(([color, qty]) => (
                          <option key={color} value={color}>{color} ({qty})</option>
                        )) : [])}
                      </select>
                      <input className="ship-input ship-qty" type="number" min="0" value={item.qty}
                        onChange={e => updateShipItem(idx, 'qty', Number(e.target.value))} />
                      <span className="ship-subtotal">{(item.subtotal||0).toLocaleString('ru-RU')} ₽</span>
                    </>
                  )}
                  {shipForm.items.length > 1 && (
                    <button className="ship-remove" onClick={() => removeShipItem(idx)}>×</button>
                  )}
                </div>
              ))}
              <button className="admin-btn admin-btn-add-item" onClick={addShipItem}>+ {t('addProduct')}</button>

              <h4 style={{marginTop:20,marginBottom:10,fontSize:14,color:'#666'}}>Оплата</h4>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <label style={{fontSize:12,color:'#999',display:'block',marginBottom:4}}>{t('prepaidAmount')}</label>
                  <input className="ship-input" type="number" min="0" value={shipForm.prepaid}
                    onChange={e => setShipForm(prev => ({...prev, prepaid: e.target.value}))} />
                </div>
                <div>
                  <label style={{fontSize:12,color:'#999',display:'block',marginBottom:4}}>{t('paidAmount')}</label>
                  <input className="ship-input" type="number" min="0" value={shipForm.paid}
                    onChange={e => setShipForm(prev => ({...prev, paid: e.target.value}))} />
                </div>
              </div>

              <div className="ship-total">
                <span>{t('total')}</span>
                <span>{shipTotal().toLocaleString('ru-RU')} ₽</span>
              </div>

              <div className="modal-actions">
                <button className="admin-btn admin-btn-cancel" onClick={closeShipModal}>Отмена</button>
                <button className="admin-btn-primary" onClick={createShipment}>Создать отгрузку</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === INVOICE MODAL === */}
      {invoiceShip && (
        <div className="modal-overlay" onClick={() => setInvoiceShip(null)}>
          <div className="modal modal-wide invoice-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Накладная {invoiceShip.number}</h3>
              <div>
                <button className="admin-btn admin-btn-print" onClick={() => window.print()}>Печать</button>
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
                {invoiceShip.client?.transport && <p>Транспортная компания: {invoiceShip.client.transport}</p>}
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
                <div className="invoice-total">
                  <span>{t('totalDue')}:</span>
                  <span className="invoice-total-amount">{(invoiceShip.total||0).toLocaleString('ru-RU')} ₽</span>
                </div>
                {invoiceShip.prepaid > 0 && (
                  <div className="invoice-paid">
                    <span>{t('prepaid')}:</span>
                    <span>{(invoiceShip.prepaid||0).toLocaleString('ru-RU')} ₽</span>
                  </div>
                )}
                {invoiceShip.paid > 0 && (
                  <div className="invoice-paid">
                    <span>{t('fullPayment')}:</span>
                    <span>{(invoiceShip.paid||0).toLocaleString('ru-RU')} ₽</span>
                  </div>
                )}
                {invoiceShip.status === 'доставлено' && (
                  <div className="invoice-status-badge">Доставлено</div>
                )}
              </div>

              <div className="invoice-footer">
                <p>OUDA — интернет-магазин скутеров</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
