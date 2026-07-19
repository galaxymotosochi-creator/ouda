import { useState } from 'react'

export default function Cart({ open, onClose, items, totalSum, onUpdateQty, onRemove, api, onSuccess }) {
  const [form, setForm] = useState({ name: '', city: '', phone: '', payment: 'cash' })
  const [sending, setSending] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.phone) return
    setSending(true)
    try {
      await fetch(`${api}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          items: items.map(i => ({ product_id: i.id, name: i.name, price: i.price, qty: i.qty })),
          total: totalSum,
        }),
      })
      onSuccess()
    } catch (err) {
      // try local storage fallback
      const localOrders = JSON.parse(localStorage.getItem('ouda_orders') || '[]')
      localOrders.push({
        id: Date.now(),
        ...form,
        items: items.map(i => ({ product_id: i.id, name: i.name, price: i.price, qty: i.qty })),
        total: totalSum,
        status: 'new',
        created_at: new Date().toISOString(),
      })
      localStorage.setItem('ouda_orders', JSON.stringify(localOrders))
      onSuccess()
    }
    setSending(false)
  }

  return (
    <>
      <div className={`cart-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`cart-sidebar ${open ? 'open' : ''}`}>
        <div className="cart-header">
          <h3>🛒 Корзина</h3>
          <button className="cart-close" onClick={onClose}>✕</button>
        </div>

        <div className="cart-items">
          {items.length === 0 ? (
            <div className="cart-empty">Корзина пуста</div>
          ) : (
            items.map(item => (
              <div key={item.id} className="cart-item">
                <img className="cart-item-img" src={item.image || '/placeholder.svg'} alt={item.name}
                  onError={(e) => { e.target.src = '/placeholder.svg' }} />
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.name}</div>
                  <div className="cart-item-price">{(item.price * item.qty).toLocaleString('ru-RU')} ₽</div>
                  <div className="cart-item-qty">
                    <button onClick={() => onUpdateQty(item.id, -1)}>−</button>
                    <span>{item.qty}</span>
                    <button onClick={() => onUpdateQty(item.id, 1)}>+</button>
                  </div>
                </div>
                <button className="cart-item-remove" onClick={() => onRemove(item.id)}>✕</button>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <form className="cart-form" onSubmit={handleSubmit}>
            <div className="cart-total">
              <span>Итого:</span>
              <span>{totalSum.toLocaleString('ru-RU')} ₽</span>
            </div>
            <input
              placeholder="Имя *"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
            />
            <input
              placeholder="Город"
              value={form.city}
              onChange={e => setForm({ ...form, city: e.target.value })}
            />
            <input
              placeholder="Номер телефона *"
              type="tel"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              required
            />
            <select
              value={form.payment}
              onChange={e => setForm({ ...form, payment: e.target.value })}
            >
              <option value="cash">Наличные</option>
              <option value="usdt">USDT</option>
            </select>
            <button className="cart-submit" type="submit" disabled={sending}>
              {sending ? 'Отправка...' : 'Оформить заказ'}
            </button>
          </form>
        )}
      </div>
    </>
  )
}
