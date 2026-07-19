import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../i18n'
import { PRESET_COLORS, getColorHex } from '../colors'

const API = import.meta.env.VITE_API_URL || ''
const LS_ORDERS = 'ouda_orders'
const LS_PRODUCTS = 'ouda_products'
const LS_STOCK = 'ouda_stock'

function getLocal(key) { try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] } }
function setLocal(key, data) { localStorage.setItem(key, JSON.stringify(data)) }

export default function Admin() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [tab, setTab] = useState('orders')
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [stock, setStock] = useState([])
  const [newProduct, setNewProduct] = useState({
    name: '', price: '', colors: [], power: '', fuel: '', cooling: '', max_speed: '', wheels: '', description: '', image: ''
  })

  useEffect(() => {
    if (!sessionStorage.getItem('ouda_admin')) { navigate('/login'); return }
    loadData()
  }, [])

  const loadData = () => {
    fetch(`${API}/api/orders`).then(r => r.json()).then(setOrders).catch(() => setOrders(getLocal(LS_ORDERS)))
    fetch(`${API}/api/products`).then(r => r.json()).then(setProducts).catch(() => setProducts(getLocal(LS_PRODUCTS)))
    fetch(`${API}/api/stock`).then(r => r.json()).then(setStock).catch(() => setStock(getLocal(LS_STOCK)))
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

  const toggleColor = (preset) => {
    setNewProduct(prev => {
      const exists = prev.colors.find(c => c.name === preset.name)
      if (exists) {
        return { ...prev, colors: prev.colors.filter(c => c.name !== preset.name) }
      }
      return { ...prev, colors: [...prev.colors, { name: preset.name, hex: preset.hex }] }
    })
  }

  const addProduct = (e) => {
    e.preventDefault()
    const basePrice = Number(newProduct.price) || (newProduct.colors[0]?.price ? Number(newProduct.colors[0].price) : 0)
    const product = { ...newProduct, price: basePrice, id: Date.now() }
    fetch(`${API}/api/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product) })
      .catch(() => {
        const list = getLocal(LS_PRODUCTS)
        list.push(product)
        setLocal(LS_PRODUCTS, list)
      })
    setNewProduct({ name: '', price: '', colors: [], power: '', fuel: '', cooling: '', max_speed: '', wheels: '', description: '', image: '' })
    setTimeout(loadData, 300)
  }

  const deleteProduct = (id) => {
    fetch(`${API}/api/products/${id}`, { method: 'DELETE' })
      .catch(() => {
        const list = getLocal(LS_PRODUCTS).filter(p => p.id !== id)
        setLocal(LS_PRODUCTS, list)
        setProducts(list)
      })
    setTimeout(loadData, 300)
  }

  const addStock = (e) => {
    e.preventDefault()
    const form = new FormData(e.target)
    const entry = {
      id: Date.now(),
      product_id: Number(form.get('product_id')),
      product_name: products.find(p => p.id === Number(form.get('product_id')))?.name || '—',
      qty: Number(form.get('qty')),
      date: form.get('date') || new Date().toISOString().slice(0, 10),
    }
    fetch(`${API}/api/stock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) })
      .catch(() => {
        const list = getLocal(LS_STOCK)
        list.push(entry)
        setLocal(LS_STOCK, list)
      })
    e.target.reset()
    setTimeout(loadData, 300)
  }

  const statusLabel = (s) => {
    const map = { new: t('new'), accepted: t('accepted'), done: t('completed') }
    return map[s] || s
  }
  const statusClass = (s) => {
    const map = { new: 'status-new', accepted: 'status-accepted', done: 'status-done' }
    return map[s] || ''
  }
  const logout = () => { sessionStorage.removeItem('ouda_admin'); navigate('/login') }

  if (!sessionStorage.getItem('ouda_admin')) return null

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h2>🔧 {t('adminTitle')}</h2>
        <button className="admin-logout" onClick={logout}>{t('logout')}</button>
      </div>
      <div className="admin-content">
        <div className="admin-tabs">
          {[
            { key: 'orders', label: `📋 ${t('orders')} (${orders.length})` },
            { key: 'products', label: `🏍️ ${t('products')} (${products.length})` },
            { key: 'stock', label: `📦 ${t('stock')}` },
          ].map(tabItem => (
            <button key={tabItem.key} className={`admin-tab ${tab === tabItem.key ? 'active' : ''}`}
              onClick={() => setTab(tabItem.key)}>{tabItem.label}</button>
          ))}
        </div>

        {tab === 'orders' && (
          <table className="admin-table">
            <thead><tr>
              <th>№</th><th>{t('date')}</th><th>{t('name')}</th><th>{t('city')}</th><th>{t('phone')}</th>
              <th>{t('products')}</th><th>{t('total')}</th><th>{t('payment')}</th><th>{t('status')}</th><th></th>
            </tr></thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={o.id}>
                  <td>{i+1}</td>
                  <td style={{fontSize:13,color:'#999'}}>{new Date(o.created_at).toLocaleString('ru-RU')}</td>
                  <td><strong>{o.name}</strong></td>
                  <td>{o.city||'—'}</td>
                  <td>{o.phone}</td>
                  <td style={{fontSize:13}}>{o.items?.map(item => `${item.name} ×${item.qty}`).join(', ')||'—'}</td>
                  <td><strong>{(o.total||0).toLocaleString('ru-RU')} ₽</strong></td>
                  <td><span className={`admin-badge badge-${o.payment||'cash'}`}>{o.payment==='usdt'?'USDT':t('cash')}</span></td>
                  <td><span className={`status ${statusClass(o.status)}`}>{statusLabel(o.status)}</span></td>
                  <td>
                    <div className="admin-actions">
                      {o.status==='new' && <button className="admin-btn admin-btn-accept" onClick={() => updateStatus(o.id,'accepted')}>{t('accept')}</button>}
                      {o.status!=='done' && <button className="admin-btn admin-btn-done" onClick={() => updateStatus(o.id,'done')}>{t('done')}</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length===0 && <tr><td colSpan={10} style={{textAlign:'center',color:'#666',padding:40}}>{t('noOrders')}</td></tr>}
            </tbody>
          </table>
        )}

        {tab === 'products' && (
          <>
            <form className="admin-add-form" onSubmit={addProduct}>
              <h3>{t('addProduct')}</h3>
              <div className="form-grid">
                <input placeholder={`${t('nameLabel')} *`} value={newProduct.name}
                  onChange={e => setNewProduct({...newProduct, name: e.target.value})} required />
                <input placeholder={`${t('priceLabel')} *`} type="number" value={newProduct.price}
                  onChange={e => setNewProduct({...newProduct, price: e.target.value})} required />
                <div className="full-width">
                  <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:8}}>🎨 {t('color')}</div>
                  <div className="palette">
                    {PRESET_COLORS.map(p => {
                      const selected = newProduct.colors.some(c => c.name === p.name)
                      return (
                        <div
                          key={p.name}
                          className={`palette-color ${selected ? 'selected' : ''} ${p.hex === 'chameleon' ? 'color-swatch-chameleon' : ''}`}
                          style={p.hex !== 'chameleon' ? { background: p.hex } : {}}
                          onClick={() => toggleColor(p)}
                          title={p.name}
                        >
                          {selected && <span className="palette-check">✓</span>}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginTop:6}}>Выбрано: {newProduct.colors.map(c => c.name).join(', ') || '—'}</div>
                </div>
                <input placeholder={t('power')} value={newProduct.power}
                  onChange={e => setNewProduct({...newProduct, power: e.target.value})} />
                <input placeholder={t('fuel')} value={newProduct.fuel}
                  onChange={e => setNewProduct({...newProduct, fuel: e.target.value})} />
                <input placeholder={t('cooling')} value={newProduct.cooling}
                  onChange={e => setNewProduct({...newProduct, cooling: e.target.value})} />
                <input placeholder={t('max_speed')} value={newProduct.max_speed}
                  onChange={e => setNewProduct({...newProduct, max_speed: e.target.value})} />
                <input placeholder={t('wheels')} value={newProduct.wheels}
                  onChange={e => setNewProduct({...newProduct, wheels: e.target.value})} />
                <input placeholder={t('photoLink')} value={newProduct.image}
                  onChange={e => setNewProduct({...newProduct, image: e.target.value})} />
                <div className="full-width">
                  <textarea placeholder={t('descLabel')} value={newProduct.description}
                    onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
                </div>
                <button type="submit">➕ {t('addProduct')}</button>
              </div>
            </form>
            <table className="admin-table">
              <thead><tr>
                <th>{t('nameLabel')}</th><th>{t('priceLabel')}</th><th>{t('power')}</th><th>{t('fuel')}</th><th>{t('wheels')}</th><th>Цвета</th><th></th>
              </tr></thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.price.toLocaleString('ru-RU')} ₽</td>
                    <td>{p.power||'—'}</td>
                    <td>{p.fuel||'—'}</td>
                    <td>{p.wheels||'—'}</td>
                    <td>{p.colors?.length > 0 ? (
                      <div className="color-swatches" style={{margin:0}}>
                        {p.colors.map((c, i) => (
                          <div key={i} className={`color-swatch ${c.hex === 'chameleon' ? 'color-swatch-chameleon' : ''}`} style={c.hex !== 'chameleon' ? {background:c.hex,width:16,height:16,cursor:'default'} : {width:16,height:16,cursor:'default'}} title={c.name} />
                        ))}
                      </div>
                    ) : (p.color || '—')}</td>
                    <td><button className="admin-btn admin-btn-done" onClick={() => deleteProduct(p.id)} style={{color:'#ef4444'}}>🗑️</button></td>
                  </tr>
                ))}
                {products.length===0 && <tr><td colSpan={6} style={{textAlign:'center',color:'#666',padding:40}}>{t('noProducts')}</td></tr>}
              </tbody>
            </table>
          </>
        )}

        {tab === 'stock' && (
          <>
            <form className="admin-add-form" onSubmit={addStock}>
              <h3>{t('addStock')}</h3>
              <div className="form-grid">
                <select name="product_id" required>
                  <option value="">{t('selectProduct')}</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input name="qty" type="number" placeholder={t('qty')} required min="1" />
                <input name="date" type="date" className="full-width" defaultValue={new Date().toISOString().slice(0,10)} />
                <button type="submit">📦 {t('addStock')}</button>
              </div>
            </form>
            <div className="stock-list">
              {stock.map(s => (
                <div key={s.id} className="stock-item">
                  <div className="stock-item-info">
                    <strong>{s.product_name}</strong>
                    <span>×{s.qty}</span>
                    <span style={{color:'#666',fontSize:13}}>{s.date}</span>
                  </div>
                </div>
              ))}
              {stock.length===0 && <p style={{color:'#666',textAlign:'center',padding:40}}>{t('noStock')}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
