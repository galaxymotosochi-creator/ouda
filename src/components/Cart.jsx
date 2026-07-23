import { useState } from 'react'
import { useLang } from '../i18n'

function getItemPrice(item, allItems) {
  // Суммарное количество товара (все цвета)
  const totalQty = (allItems || [])
    .filter(i => i.id === item.id)
    .reduce((s, i) => s + i.qty, 0)
  // 1 шт → розничная цена, 2+ шт → оптовая (если указана)
  if (totalQty >= 2 && item.wholesale_price && Number(item.wholesale_price) > 0) {
    return Number(item.wholesale_price)
  }
  return Number(item.price) || 0
}

export default function Cart({ open, onClose, items, totalSum, onUpdateQty, onRemove, onAddAnother, api, onSuccess }) {
  const { t } = useLang()
  const [form, setForm] = useState({ name: '', city: '', phone: '', transport: '', payment: 'cash' })
  const [sending, setSending] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.phone || !form.city || !form.transport) return
    setSending(true)
    try {
      const effectiveTotal = items.reduce((s, i) => s + getItemPrice(i, items) * i.qty, 0)
      await fetch(`${api}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          items: items.map(i => ({ product_id: i.id, name: i.name, price: getItemPrice(i, items), qty: i.qty, color: i.selectedColor || '' })),
          total: effectiveTotal,
        }),
      })
      onSuccess()
    } catch {
      const effectiveTotal = items.reduce((s, i) => s + getItemPrice(i, items) * i.qty, 0)
      const localOrders = JSON.parse(localStorage.getItem('ouda_orders') || '[]')
      localOrders.push({
        id: Date.now(), ...form,
        items: items.map(i => ({ product_id: i.id, name: i.name, price: getItemPrice(i, items), qty: i.qty, color: i.selectedColor || '' })),
        total: effectiveTotal, status: 'new', created_at: new Date().toISOString(),
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
          <h3>{t('cartTitle')}</h3>
          <button className="cart-close" onClick={onClose}>✕</button>
        </div>
        <div className="cart-items">
          {items.length === 0 ? (
            <div className="cart-empty">{t('cartEmpty')}</div>
          ) : (
            items.map(item => (
              <div key={item.cartKey} className="cart-item">
                <img className="cart-item-img" src={item.images?.[0] || item.image || '/placeholder.svg'} alt={item.name}
                  onError={(e) => { e.target.src = '/placeholder.svg' }} />
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.name}{item.selectedColor ? ` — ${item.selectedColor}` : ''}</div>
                  <div className="cart-item-price">
                    {item.qty >= 2 && item.wholesale_price && Number(item.wholesale_price) > 0 ? (
                      <>
                        <span style={{textDecoration:'line-through',color:'#999',marginRight:6,fontSize:12}}>
                          {(Number(item.price) * item.qty).toLocaleString('ru-RU')}
                        </span>
                        {(getItemPrice(item, items) * item.qty).toLocaleString('ru-RU')} {t('rub')}
                        <span style={{display:'block',fontSize:11,color:'#555',fontWeight:500}}>Оптовая цена</span>
                      </>
                    ) : (
                      <>{getItemPrice(item, items).toLocaleString('ru-RU')} {t('rub')} / шт</>
                    )}
                  </div>
                  <div className="cart-item-qty">
                    <button onClick={() => onUpdateQty(item.cartKey, -1)}>−</button>
                    <span>{item.qty}</span>
                    <button onClick={() => onAddAnother ? onAddAnother(item) : onUpdateQty(item.cartKey, 1)}>+</button>
                  </div>
                </div>
                <button className="cart-item-remove" onClick={() => onRemove(item.cartKey)}>✕</button>
              </div>
            ))
          )}
        </div>
        {items.length > 0 && (
          <form className="cart-form" onSubmit={handleSubmit}>
            <div className="cart-rule-hint">
              {items.some(i => {
                const totalQty = items.filter(x => x.id === i.id).reduce((s, x) => s + x.qty, 0)
                return totalQty >= 2 && i.wholesale_price && Number(i.wholesale_price) > 0
              }) && (
                <span style={{fontSize:11,color:'#555',display:'block',marginBottom:6}}>✓ Применена оптовая цена (от 2 шт)</span>
              )}
            </div>
            <div className="cart-total">
              <span>{t('total')}</span>
              <span>{items.reduce((s, i) => s + getItemPrice(i, items) * i.qty, 0).toLocaleString('ru-RU')} {t('rub')}</span>
            </div>
            <input placeholder="Имя *" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} required />
            <input placeholder="Город *" value={form.city}
              onChange={e => setForm({ ...form, city: e.target.value })} required />
            <input placeholder="Транспортная компания и адрес терминала *" value={form.transport}
              onChange={e => setForm({ ...form, transport: e.target.value })} required />
            <input placeholder="Номер телефона *" type="tel" value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })} required />
            <select value={form.payment}
              onChange={e => setForm({ ...form, payment: e.target.value })}>
              <option value="cash">{t('cash')}</option>
              <option value="usdt">{t('usdt')}</option>
            </select>
            <button className="cart-submit" type="submit" disabled={sending}>
              {sending ? t('sending') : t('submit')}
            </button>
          </form>
        )}
      </div>
    </>
  )
}
