import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || ''
const LS_ORDERS = 'ouda_orders'
const LS_PRODUCTS = 'ouda_products'
const LS_STOCK = 'ouda_stock'

function getLocal(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}
function setLocal(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

export default function Admin() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('orders')
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [stock, setStock] = useState([])
  const [newProduct, setNewProduct] = useState({
    name: '', price: '', color: '', power: '', tires: '', description: '', image: ''
  })

  useEffect(() => {
    if (!sessionStorage.getItem('ouda_admin')) {
      navigate('/login')
      return
    }
    loadData()
  }, [])

  const loadData = () => {
    // Orders
    fetch(`${API}/api/orders`)
      .then(r => r.json())
      .then(setOrders)
      .catch(() => setOrders(getLocal(LS_ORDERS)))

    // Products
    fetch(`${API}/api/products`)
      .then(r => r.json())
      .then(setProducts)
      .catch(() => setProducts(getLocal(LS_PRODUCTS)))

    // Stock
    fetch(`${API}/api/stock`)
      .then(r => r.json())
      .then(setStock)
      .catch(() => setStock(getLocal(LS_STOCK)))
  }

  const updateStatus = (id, status) => {
    fetch(`${API}/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => {
      const list = getLocal(LS_ORDERS)
      const updated = list.map(o => o.id === id ? { ...o, status } : o)
      setLocal(LS_ORDERS, updated)
      setOrders(updated)
    })
    loadData()
  }

  const addProduct = async (e) => {
    e.preventDefault()
    const product = {
      ...newProduct,
      price: Number(newProduct.price),
      id: Date.now(),
    }
    fetch(`${API}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    }).catch(() => {
      const list = getLocal(LS_PRODUCTS)
      list.push(product)
      setLocal(LS_PRODUCTS, list)
    })
    setNewProduct({ name: '', price: '', color: '', power: '', tires: '', description: '', image: '' })
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
    fetch(`${API}/api/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => {
      const list = getLocal(LS_STOCK)
      list.push(entry)
      setLocal(LS_STOCK, list)
    })
    e.target.reset()
    setTimeout(loadData, 300)
  }

  const statusLabel = (s) => {
    const map = { new: '🆕 Новый', accepted: '✅ Принят', done: '✔️ Выполнен' }
    return map[s] || s
  }

  const statusClass = (s) => {
    const map = { new: 'status-new', accepted: 'status-accepted', done: 'status-done' }
    return map[s] || ''
  }

  const logout = () => {
    sessionStorage.removeItem('ouda_admin')
    navigate('/login')
  }

  if (!sessionStorage.getItem('ouda_admin')) return null

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h2>🔧 Админка OUDA</h2>
        <button className="admin-logout" onClick={logout}>Выйти</button>
      </div>

      <div className="admin-content">
        <div className="admin-tabs">
          {[
            { key: 'orders', label: `📋 Заказы (${orders.length})` },
            { key: 'products', label: `🏍️ Товары (${products.length})` },
            { key: 'stock', label: '📦 Поступления' },
          ].map(t => (
            <button
              key={t.key}
              className={`admin-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ORDERS TAB */}
        {tab === 'orders' && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Дата</th>
                <th>Имя</th>
                <th>Город</th>
                <th>Телефон</th>
                <th>Товары</th>
                <th>Сумма</th>
                <th>Оплата</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={o.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontSize: 13, color: '#999' }}>
                    {new Date(o.created_at).toLocaleString('ru-RU')}
                  </td>
                  <td><strong>{o.name}</strong></td>
                  <td>{o.city || '—'}</td>
                  <td>{o.phone}</td>
                  <td style={{ fontSize: 13 }}>
                    {o.items?.map(item => `${item.name} ×${item.qty}`).join(', ') || '—'}
                  </td>
                  <td><strong>{(o.total || 0).toLocaleString('ru-RU')} ₽</strong></td>
                  <td>
                    <span className={`admin-badge badge-${o.payment || 'cash'}`}>
                      {o.payment === 'usdt' ? 'USDT' : 'Наличные'}
                    </span>
                  </td>
                  <td><span className={`status ${statusClass(o.status)}`}>{statusLabel(o.status)}</span></td>
                  <td>
                    <div className="admin-actions">
                      {o.status === 'new' && (
                        <button className="admin-btn admin-btn-accept" onClick={() => updateStatus(o.id, 'accepted')}>
                          Принять
                        </button>
                      )}
                      {o.status !== 'done' && (
                        <button className="admin-btn admin-btn-done" onClick={() => updateStatus(o.id, 'done')}>
                          Выполнен
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: '#666', padding: 40 }}>Пока нет заказов</td></tr>
              )}
            </tbody>
          </table>
        )}

        {/* PRODUCTS TAB */}
        {tab === 'products' && (
          <>
            <form className="admin-add-form" onSubmit={addProduct}>
              <h3>Добавить товар</h3>
              <div className="form-grid">
                <input placeholder="Название *" value={newProduct.name}
                  onChange={e => setNewProduct({...newProduct, name: e.target.value})} required />
                <input placeholder="Цена *" type="number" value={newProduct.price}
                  onChange={e => setNewProduct({...newProduct, price: e.target.value})} required />
                <input placeholder="Цвет" value={newProduct.color}
                  onChange={e => setNewProduct({...newProduct, color: e.target.value})} />
                <input placeholder="Мощность (50cc, 125cc, 2000W...)" value={newProduct.power}
                  onChange={e => setNewProduct({...newProduct, power: e.target.value})} />
                <input placeholder='Резина (10", 12"...)' value={newProduct.tires}
                  onChange={e => setNewProduct({...newProduct, tires: e.target.value})} />
                <input placeholder="Ссылка на фото" value={newProduct.image}
                  onChange={e => setNewProduct({...newProduct, image: e.target.value})} />
                <div className="full-width">
                  <textarea placeholder="Описание" value={newProduct.description}
                    onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
                </div>
                <button type="submit">➕ Добавить товар</button>
              </div>
            </form>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Цена</th>
                  <th>Цвет</th>
                  <th>Мощность</th>
                  <th>Резина</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.price.toLocaleString('ru-RU')} ₽</td>
                    <td>{p.color || '—'}</td>
                    <td>{p.power || '—'}</td>
                    <td>{p.tires || '—'}</td>
                    <td>
                      <button className="admin-btn admin-btn-done" onClick={() => deleteProduct(p.id)}
                        style={{ color: '#ef4444' }}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: '#666', padding: 40 }}>Нет товаров. Добавьте первый!</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* STOCK TAB */}
        {tab === 'stock' && (
          <>
            <form className="admin-add-form" onSubmit={addStock}>
              <h3>Добавить поступление</h3>
              <div className="form-grid">
                <select name="product_id" required>
                  <option value="">Выберите товар</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input name="qty" type="number" placeholder="Количество" required min="1" />
                <input name="date" type="date" className="full-width"
                  defaultValue={new Date().toISOString().slice(0, 10)} />
                <button type="submit">📦 Добавить поступление</button>
              </div>
            </form>

            <div className="stock-list">
              {stock.map(s => (
                <div key={s.id} className="stock-item">
                  <div className="stock-item-info">
                    <strong>{s.product_name}</strong>
                    <span>×{s.qty}</span>
                    <span style={{ color: '#666', fontSize: 13 }}>{s.date}</span>
                  </div>
                </div>
              ))}
              {stock.length === 0 && (
                <p style={{ color: '#666', textAlign: 'center', padding: 40 }}>Нет поступлений</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
