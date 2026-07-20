import { useState, useEffect, useCallback } from 'react'
import { PRESET_COLORS, getColorHex } from '../colors'
import { useLang } from '../i18n'
import Header from '../components/Header'
import Cart from '../components/Cart'
import ProductCard from '../components/ProductCard'

const API = import.meta.env.VITE_API_URL || ''

export default function Catalog() {
  const { t } = useLang()
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [toast, setToast] = useState(null)

  // Color picker modal state
  const [colorModal, setColorModal] = useState(null) // { product }
  const [colorQtys, setColorQtys] = useState({}) // { 'Чёрный': 2, 'Белый': 1 }

  useEffect(() => {
    fetch(`${API}/api/products`)
      .then(r => r.json())
      .then(setProducts)
      .catch(() => {
        setProducts([])
      })
  }, [])

  const addToCart = useCallback((product, colorName, colorHex) => {
    const key = `${product.id}_${colorName}`
    setCart(prev => {
      const exists = prev.find(item => item.cartKey === key)
      if (exists) {
        return prev.map(item =>
          item.cartKey === key ? { ...item, qty: item.qty + 1 } : item
        )
      }
      return [{
        ...product,
        cartKey: key,
        selectedColor: colorName,
        selectedHex: colorHex || '',
        qty: 1,
      }, ...prev]
    })
  }, [])

  const handleAddClick = (product, needsColor) => {
    if (needsColor) {
      // Init quantities from available_colors
      const avail = product.available_colors || {}
      const init = {}
      Object.keys(avail).forEach(name => { init[name] = 0 })
      setColorQtys(init)
      setColorModal({ product })
    } else {
      const availColors = Object.keys(product.available_colors || {}).filter(k => product.available_colors[k] > 0)
      const firstName = availColors[0] || ''
      addToCart(product, firstName, '')
    }
  }

  const handleColorQty = (name, delta) => {
    const maxAvail = (colorModal?.product?.available_colors || {})[name] || 0
    setColorQtys(prev => ({
      ...prev,
      [name]: Math.max(0, Math.min(maxAvail, (prev[name] || 0) + delta))
    }))
  }

  const handleAddColorsToCart = () => {
    if (!colorModal) return
    Object.entries(colorQtys).forEach(([name, qty]) => {
      if (qty > 0) {
        for (let i = 0; i < qty; i++) {
          addToCart(colorModal.product, name, '')
        }
      }
    })
    setColorModal(null)
  }

  const updateQty = useCallback((cartKey, delta) => {
    setCart(prev =>
      prev.map(item => {
        if (item.cartKey !== cartKey) return item
        const newQty = item.qty + delta
        if (newQty <= 0) return null
        return { ...item, qty: newQty }
      }).filter(Boolean)
    )
  }, [])

  const removeFromCart = useCallback((cartKey) => {
    setCart(prev => prev.filter(item => item.cartKey !== cartKey))
  }, [])

  const totalItems = cart.reduce((s, i) => s + i.qty, 0)
  const totalSum = cart.reduce((s, i) => s + i.price * i.qty, 0)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <>
      <Header cartCount={totalItems} onCartClick={() => setCartOpen(true)} />

      <section className="hero" style={{backgroundImage:'url(/hero.jpg?v=' + Date.now() + ')'}}>
        <div className="hero-overlay">
          <h1>{t('heroTitle')}</h1>
          <div className="hero-desc-glass">
            Скутера оптом и в розницу напрямую от завода-изготовителя. Склад в Москве. Доставка по всей России.
          </div>
          <a href="#catalog" className="hero-btn">{t('heroBtn')}</a>
          <div className="hero-contacts">
            <a href="https://wa.me/79628888888" target="_blank" className="glass-btn">
              <img src="/manager-sapa.jpg" alt="MAX" className="glass-avatar" />
              <span>MAX — WhatsApp</span>
            </a>
            <a href="https://t.me/ouda_scooters" target="_blank" className="glass-btn">
              <img src="/manager-tg.jpg" alt="Telegram" className="glass-avatar" />
              <span>Telegram: @ouda_scooters</span>
            </a>
          </div>
        </div>
      </section>

      <section className="catalog" id="catalog">
        <div className="catalog-grid">
          {products.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onAdd={handleAddClick}
              inCart={cart.some(c => c.id === product.id)}
            />
          ))}
        </div>
      </section>

      <Cart
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        totalSum={totalSum}
        onUpdateQty={updateQty}
        onRemove={removeFromCart}
        onAddAnother={(item) => {
          const product = products.find(p => p.id === item.id)
          const availColors = Object.keys(product?.available_colors || {}).filter(k => (product.available_colors[k] || 0) > 0)
          if (availColors.length > 1) {
            const init = {}
            availColors.forEach(name => { init[name] = 0 })
            setColorQtys(init)
            setColorModal({ product })
          } else {
            addToCart(product, item.selectedColor || (availColors[0] || ''), '')
          }
        }}
        api={API}
        onSuccess={() => {
          setCart([])
          setCartOpen(false)
          showToast(t('successMsg'))
        }}
      />

      {toast && <div className="success-toast">{toast}</div>}

      {/* Color picker modal */}
      {colorModal && (
        <div className="color-modal-overlay" onClick={() => setColorModal(null)}>
          <div className="color-modal" onClick={e => e.stopPropagation()}>
            <h4>{colorModal.product.name}</h4>
            <p style={{fontSize:13,color:'#666',marginBottom:16}}>Выберите цвета и количество</p>
            <div className="color-picker-list">
              {Object.entries(colorQtys).filter(([,qty]) => qty > 0 || true).map(([name, qty]) => {
                const avail = (colorModal.product.available_colors || {})[name] || 0
                return (
                  <div key={name} className="color-picker-item">
                    <span className="color-picker-name">{name}</span>
                    <div className="cart-item-qty" style={{marginLeft:'auto'}}>
                      <button onClick={() => handleColorQty(name, -1)}>−</button>
                      <span>{qty}</span>
                      <button onClick={() => handleColorQty(name, 1)}>+</button>
                    </div>
                    {avail > 0 && <span style={{fontSize:11,color:'#999',marginLeft:8}}>в нал. {avail}</span>}
                  </div>
                )
              })}
            </div>
            <div style={{marginTop:16,borderTop:'1px solid var(--border)',paddingTop:16}}>
              <button className="product-add" onClick={handleAddColorsToCart}>
                Добавить в корзину
              </button>
              <button className="color-modal-cancel" onClick={() => setColorModal(null)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
