import { useState } from 'react'
import { useLang } from '../i18n'

function getItemPrice(item, allItems) {
  // Общее количество ВСЕХ товаров в корзине
  const totalQty = (allItems || []).reduce((s, i) => s + i.qty, 0)
  // 3+ шт в сумме → оптовая цена для всех позиций (если указана)
  if (totalQty >= 3 && item.wholesale_price && Number(item.wholesale_price) > 0) {
    return Number(item.wholesale_price)
  }
  return Number(item.price) || 0
}

export default function Cart({ open, onClose, items, totalSum, onUpdateQty, onRemove, onAddAnother, api, onSuccess }) {
  const { t } = useLang()
  const [form, setForm] = useState({ name: '', city: '', phone: '+7', transport: '', payment: 'cash' })
  const [sending, setSending] = useState(false)
  const [pickup, setPickup] = useState(false)
  const [deliveryCost, setDeliveryCost] = useState(null)
  const [deliveryDays, setDeliveryDays] = useState(null)
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const [deliveryError, setDeliveryError] = useState('')
  const [terminals, setTerminals] = useState([])
  const [selectedTerminal, setSelectedTerminal] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.phone || form.phone === '+7' || !form.city) return
    setSending(true)
    try {
      const effectiveTotal = items.reduce((s, i) => s + getItemPrice(i, items) * i.qty, 0)
      const orderData = {
        ...form,
        city: pickup ? 'Москва' : form.city,
        transport: pickup ? 'Самовывоз (Москва)' : form.transport,
        pickup,
        items: items.map(i => ({ product_id: i.id, name: i.name, price: getItemPrice(i, items), qty: i.qty, color: i.selectedColor || '' })),
        total: effectiveTotal,
        delivery_cost: deliveryCost,
        delivery_terminal: selectedTerminal || form.transport,
      }
      await fetch(`${api}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      })
      onSuccess()
    } catch {
      const effectiveTotal = items.reduce((s, i) => s + getItemPrice(i, items) * i.qty, 0)
      const localOrders = JSON.parse(localStorage.getItem('ouda_orders') || '[]')
      localOrders.push({
        id: Date.now(), ...form,
        city: pickup ? 'Москва' : form.city,
        transport: pickup ? 'Самовывоз (Москва)' : form.transport,
        pickup,
        items: items.map(i => ({ product_id: i.id, name: i.name, price: getItemPrice(i, items), qty: i.qty, color: i.selectedColor || '' })),
        total: effectiveTotal, status: 'new', created_at: new Date().toISOString(),
        delivery_cost: deliveryCost,
        delivery_terminal: selectedTerminal || form.transport,
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
                    {items.reduce((s, i) => s + i.qty, 0) >= 3 && item.wholesale_price && Number(item.wholesale_price) > 0 ? (
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
              {items.reduce((s, i) => s + i.qty, 0) >= 3 && items.some(i => i.wholesale_price && Number(i.wholesale_price) > 0) && (
                <span style={{fontSize:11,color:'#555',display:'block',marginBottom:6}}>✓ Применена оптовая цена (от 3 шт в корзине)</span>
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
            <input type="hidden" value={pickup ? 'Самовывоз (Москва)' : form.transport} />

            {!pickup && form.city && form.city !== 'Москва' && (
              <div style={{marginBottom:12}}>
                <button type="button" className="cart-delivery-btn" onClick={async function() {
                  setDeliveryLoading(true)
                  setDeliveryError('')
                  try {
                    var cityRes = await fetch(api + '/api/search-city', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: form.city })
                    })
                    var cityData = await cityRes.json()
                    if (!cityData.code) { setDeliveryError(t('deliveryNotFoundCity')); setDeliveryLoading(false); return }

                    // Fetch ALL terminals, then filter by city name
                    var termRes = await fetch(api + '/api/search-terminals', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ city_code: cityData.code })
                    })
                    var termData = await termRes.json()
                    var filtered = (Array.isArray(termData) ? termData : []).filter(function(t) {
                      return t.cityName && t.cityName.toLowerCase() === cityData.name.toLowerCase()
                    })
                    setTerminals(filtered)

                    // Calculate delivery
                    var calcRes = await fetch(api + '/api/calculate-delivery', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        city_code: cityData.code,
                        items: items.map(function(item) {
                          return {
                            qty: item.qty,
                            price: item.price,
                            weight: item.weight,
                            length: item.length,
                            width: item.width,
                            height: item.height
                          }
                        })
                      })
                    })
                    var calcData = await calcRes.json()
                    if (calcData[0] && calcData[0]['01']) {
                      setDeliveryCost(calcData[0]['01'].cost)
                      setDeliveryDays(calcData[0]['01'].time)
                    } else {
                      setDeliveryError('Не удалось рассчитать')
                    }
                  } catch(e) {
                    setDeliveryError('Ошибка соединения')
                  }
                  setDeliveryLoading(false)
                }}>
                  {deliveryLoading ? 'Расчёт...' : 'Рассчитать доставку'}
                </button>
                {deliveryError && <div style={{fontSize:12,color:'#e53e3e',marginTop:4}}>{deliveryError}</div>}
                {deliveryCost !== null && (
                  <div style={{marginTop:8,padding:'10px 14px',background:'#f0fdf4',borderRadius:10,border:'1px solid #bbf7d0'}}>
                    <div style={{fontSize:14,fontWeight:600,color:'#065f46'}}>Доставка: {deliveryCost.toLocaleString('ru-RU')} ₽</div>
                    {deliveryDays && <div style={{fontSize:12,color:'#888',marginTop:2}}>Срок: ~{deliveryDays} дн.</div>}

                    {terminals.length > 0 && (
                      <div style={{marginTop:8}}>
                        <label style={{fontSize:11,color:'#888',display:'block',marginBottom:4}}>Терминал получения ТК &quot;КИТ&quot;:</label>
                        <select className="v2-input" style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid #ccc',fontSize:13}}
                          value={selectedTerminal}
                          onChange={function(e) {
                            var val = e.target.value
                            setSelectedTerminal(val)
                            // Auto-fill transport field
                            var addr = val || form.transport
                            setForm({ ...form, transport: addr })
                          }}>
                          <option value="">— Выберите терминал —</option>
                          {terminals.map(function(t, i) {
                            return <option key={i} value={t.value}>{t.value}</option>
                          })}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="cart-pickup" onClick={() => {
              setPickup(v => {
                if (!v) {
                  setForm(f => ({ ...f, city: 'Москва', transport: 'Самовывоз (Москва)' }))
                } else {
                  setForm(f => ({ ...f, city: '', transport: '' }))
                }
                return !v
              })
            }}>
              <div className={`cart-toggle-track ${pickup ? 'active' : ''}`}>
                <div className="cart-toggle-thumb" />
              </div>
              <span>{t('pickupLabel')}</span>
            </div>
            <input placeholder="Номер телефона *" type="tel" value={form.phone}
              onChange={e => {
                const v = e.target.value.replace(/[^0-9]/g, '')
                const cleaned = v.startsWith('7') ? '+7' + v.slice(1) : '+7' + v
                setForm({ ...form, phone: cleaned })
              }} required />
            <select value={form.payment}
              onChange={e => setForm({ ...form, payment: e.target.value })}>
              <option value="cash">{t('cash')}</option>
              <option value="usdt">{t('usdt')}</option>
              <option value="credit">{t('credit')}</option>
              <option value="discuss">{t('discuss')}</option>
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
