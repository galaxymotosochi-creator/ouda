import { useState, useEffect, useCallback, useMemo } from 'react'
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
      .catch(() => { setProducts([]) })
  }, [])

  // Cart index: product_id_color -> qty in cart
  const cartQtys = useMemo(() => {
    const idx = {}
    cart.forEach(item => { idx[item.cartKey] = item.qty })
    return idx
  }, [cart])

  // Total in cart per product (sum across all colors)
  const productCartQty = useMemo(() => {
    const idx = {}
    cart.forEach(item => {
      idx[item.id] = (idx[item.id] || 0) + item.qty
    })
    return idx
  }, [cart])

  const addToCart = useCallback((product, colorName, colorHex) => {
    const key = `${product.id}_${colorName}`
    setCart(prev => {
      const avail = (product.available_colors || {})[colorName] || 0
      const inCart = prev.filter(i => i.cartKey === key).reduce((s, i) => s + i.qty, 0)
      if (avail <= inCart) return prev

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
    const avail = product.available_colors || {}
    const availColors = Object.keys(avail).filter(k => (avail[k] || 0) > 0)

    if (needsColor && availColors.length > 1) {
      // Open color picker — show remaining (avail - inCart)
      const init = {}
      availColors.forEach(name => {
        const remaining = (avail[name] || 0) - (cartQtys[`${product.id}_${name}`] || 0)
        init[name] = 0 // always start at 0, user picks
      })
      // Show remaining near color name
      setColorQtys(init)
      setColorModal({ product })
    } else {
      // Single color or no color choice
      const firstName = availColors[0] || ''
      addToCart(product, firstName, '')
    }
  }

  const handleColorQty = (name, delta) => {
    setColorQtys(prev => ({
      ...prev,
      [name]: Math.max(0, (prev[name] || 0) + delta)
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
  const getItemPrice = (item) => {
    const totalQty = cart
      .filter(x => x.id === item.id)
      .reduce((s, x) => s + x.qty, 0)
    if (totalQty >= 2 && item.wholesale_price && Number(item.wholesale_price) > 0) {
      return Number(item.wholesale_price)
    }
    return Number(item.price) || 0
  }
  const totalSum = cart.reduce((s, i) => s + getItemPrice(i) * i.qty, 0)

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
            {t('heroGlass')}
          </div>
          <a href="#catalog" className="hero-btn">{t('heroBtn')}</a>
          <div className="hero-contacts">
            <a href="https://max.ru/u/f9LHodD0cOKl_rlTV9a9EsXejDlc-Be7NLdhMcpCfu16AH6yJIUX5j9q9SM" target="_blank" className="glass-btn">
              <img src="/manager-sapa.jpg" alt="MAX" className="glass-avatar" />
              <span>MAX</span>
            </a>
            <a href="https://t.me/ouda_scooters" target="_blank" className="glass-btn">
              <img src="/manager-tg.jpg" alt="Telegram" className="glass-avatar" />
              <span>Telegram</span>
            </a>
          </div>
        </div>
      </section>

      <section className="catalog" id="catalog">
        <div className="catalog-grid">
          {products.map(product => {
            const inCart = (productCartQty[product.id] || 0) > 0
            return (
              <ProductCard
                key={product.id}
                product={product}
                onAdd={handleAddClick}
                inCart={inCart}
                cartQtys={cartQtys}
              />
            )
          })}
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
          if (!product) return
          const availColors = Object.keys(product.available_colors || {}).filter(k => (product.available_colors[k] || 0) > 0)
          if (availColors.length > 1) {
            const init = {}
            availColors.forEach(name => {
              const remaining = (product.available_colors[name] || 0) - (cartQtys[`${product.id}_${name}`] || 0)
              init[name] = remaining > 0 ? 0 : -1
            })
            setColorQtys(init)
            setColorModal({ product })
          } else {
            const firstName = availColors[0] || item.selectedColor || ''
            addToCart(product, firstName, '')
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
              {Object.entries(colorQtys)
                .filter(([,qty]) => qty >= 0)
                .map(([name, qty]) => {
                  const product = colorModal.product
                  const avail = (product.available_colors || {})[name] || 0
                  const inCart = cartQtys[`${product.id}_${name}`] || 0
                  const remaining = Math.max(0, avail - inCart)
                  return (
                    <div key={name} className="color-picker-item">
                      <span className="color-picker-name">{name}</span>
                      <div className="color-picker-controls">
                        <div className="cart-item-qty">
                          <button onClick={() => handleColorQty(name, -1)}>−</button>
                          <span>{qty}</span>
                          <button onClick={() => handleColorQty(name, 1)}>+</button>
                        </div>
                        {remaining > 0 ? (
                          <span className="color-picker-remain">в наличии {remaining} шт</span>
                        ) : (
                          <span className="color-picker-remain">всё в корзине</span>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
            <div style={{marginTop:16,borderTop:'1px solid var(--border)',paddingTop:16,textAlign:'right'}}>
              <button className="color-modal-cancel" onClick={() => setColorModal(null)}>
                Отмена
              </button>
              <button className="product-add" onClick={handleAddColorsToCart}
                disabled={Object.values(colorQtys).reduce((s, v) => s + v, 0) === 0}>
                Добавить в корзину
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
