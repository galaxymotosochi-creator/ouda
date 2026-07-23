import { useState } from 'react'
import { useLang } from '../i18n'

function getItemPrice(item) {
  // 1 шт → розничная цена, 2+ шт → оптовая (если указана)
  if (item.qty >= 2 && item.wholesale_price && Number(item.wholesale_price) > 0) {
    return Number(item.wholesale_price)
  }
  return Number(item.price) || 0
}

export default function Cart({ open, onClose, items, totalSum, onUpdateQty, onRemove, onAddAnother, api, onSuccess }) {
  const { t } = useLang()
  const [form, setForm] = useState({ name: '', city: '', phone: '', payment: 'cash' })
  const [sending, setSending] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.phone) return
    setSending(true)
    try {
      const effectiveTotal = items.reduce((s, i) => s + getItemPrice(i) * i.qty, 0)
      await fetch(`${api}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          items: items.map(i => ({ product_id: i.id, name: i.name, price: getItemPrice(i), qty: i.qty, color: i.selectedColor || '' })),
          total: effectiveTotal,
        }),
      })
      onSuccess()
    } catch {
      const effectiveTotal = items.reduce((s, i) => s + getItemPrice(i) * i.qty, 0)
      const localOrders = JSON.parse(localStorage.getItem('ouda_orders') || '[]')
      localOrders.push({
        id: Date.now(), ...form,
        items: items.map(i => ({ product_id: i.id, name: i.name, price: getItemPrice(i), qty: i.qty, color: i.selectedColor || '' })),
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
          <h3>🛒 {t('cartTitle')}</h3>
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
                        {(getItemPrice(item) * item.qty).toLocaleString('ru-RU')} {t('rub')}
                        <span style={{display:'block',fontSize:11,color:'#22c55e',fontWeight:500}}>Оптовая цена</span>
                      </>
                    ) : (
                      <>{getItemPrice(item).toLocaleString('ru-RU')} {t('rub')} / шт</>
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
              {items.some(i => i.qty >= 2 && i.wholesale_price && Number(i.wholesale_price) > 0) && (
                <span style={{fontSize:11,color:'#22c55e',display:'block',marginBottom:6}}>✓ Применена оптовая цена (от 2 шт)</span>
              )}
            </div>
            <div className="cart-total">
              <span>{t('total')}</span>
              <span>{items.reduce((s, i) => s + getItemPrice(i) * i.qty, 0).toLocaleString('ru-RU')} {t('rub')}</span>
            </div>
            <input placeholder={t('name')} value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} required />
            <input placeholder={t('city')} value={form.city}
              onChange={e => setForm({ ...form, city: e.target.value })} />
            <input placeholder={t('phone')} type="tel" value={form.phone}
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
