import { useState } from 'react'
import { useLang } from '../i18n'

export default function PreorderModal({ product, onClose, api }) {
  const { t } = useLang()
  const [form, setForm] = useState({ name: '', phone: '+7', qty: 1, city: '' })
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.phone || form.phone === '+7' || !form.city) return
    setSending(true)
    try {
      await fetch(`${api}/api/preorders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          product_name: product.name,
          name: form.name,
          phone: form.phone,
          qty: form.qty,
          city: form.city,
        }),
      })
      setDone(true)
    } catch {
      const local = JSON.parse(localStorage.getItem('ouda_preorders') || '[]')
      local.push({
        id: Date.now(),
        product_id: product.id,
        product_name: product.name,
        name: form.name,
        phone: form.phone,
        qty: form.qty,
        city: form.city,
        created_at: new Date().toISOString(),
      })
      localStorage.setItem('ouda_preorders', JSON.stringify(local))
      setDone(true)
    }
    setSending(false)
  }

  return (
    <div className="preorder-modal-overlay" onClick={onClose}>
      <div className="preorder-modal" onClick={e => e.stopPropagation()}>
        {done ? (
          <>
            <div className="preorder-success">
              <span className="preorder-success-icon">✅</span>
              <h3>{t('preorderThankYou')}</h3>
              <p>{t('preorderText')}</p>
              <button className="product-add" onClick={onClose}>{t('preorderClose')}</button>
            </div>
          </>
        ) : (
          <>
            <h3>{t('preorderTitle')}</h3>
            <p className="preorder-product-name">{product.name}</p>
            <form className="preorder-form" onSubmit={handleSubmit}>
              <input
                placeholder={t('preorderName')}
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
              />
              <input
                placeholder={t('preorderPhone')}
                type="tel"
                value={form.phone}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9]/g, '')
                  const cleaned = v.startsWith('7') ? '+7' + v.slice(1) : '+7' + v
                  setForm({ ...form, phone: cleaned })
                }}
                required
              />
              <div className="preorder-qty-row">
                <label>{t('preorderQty')}</label>
                <div className="cart-item-qty">
                  <button type="button" onClick={() => setForm(f => ({ ...f, qty: Math.max(1, f.qty - 1) }))}>−</button>
                  <span>{form.qty}</span>
                  <button type="button" onClick={() => setForm(f => ({ ...f, qty: f.qty + 1 }))}>+</button>
                </div>
              </div>
              <input
                placeholder={t('preorderCity')}
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
                required
              />
              <div className="preorder-actions">
                <button type="button" className="color-modal-cancel" onClick={onClose}>{t('preorderCancel')}</button>
                <button type="submit" className="product-add" disabled={sending}>
                  {sending ? t('preorderSending') : t('preorderSubmit')}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
