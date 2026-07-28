import { useState, useEffect, useCallback, useMemo } from 'react'
import { PRESET_COLORS, getColorHex } from '../colors'
import { useLang } from '../i18n'
import Header from '../components/Header'
import Cart from '../components/Cart'
import ProductCard from '../components/ProductCard'
import PreorderModal from '../components/PreorderModal'
import FAQ from '../components/FAQ'
import BottomNav from '../components/BottomNav'

const API = import.meta.env.VITE_API_URL || ''

export default function Catalog() {
  const { t } = useLang()
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [toast, setToast] = useState(null)

  // Preorder modal state
  const [preorderModal, setPreorderModal] = useState(null) // product or null

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
    setCart(prev => {
      let updated = [...prev]
      const product = colorModal.product
      Object.entries(colorQtys).forEach(([name, qty]) => {
        if (qty <= 0) return
        const avail = (product.available_colors || {})[name] || 0
        const key = `${product.id}_${name}`
        const inCart = updated.filter(i => i.cartKey === key).reduce((s, i) => s + i.qty, 0)
        const canAdd = Math.max(0, Math.min(qty, avail - inCart))
        if (canAdd <= 0) return
        const exist = updated.find(item => item.cartKey === key)
        if (exist) {
          updated = updated.map(item =>
            item.cartKey === key ? { ...item, qty: item.qty + canAdd } : item
          )
        } else {
          updated = [{ ...product, cartKey: key, selectedColor: name, selectedHex: '', qty: canAdd }, ...updated]
        }
      })
      return updated
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
    const totalQty = cart.reduce((s, x) => s + x.qty, 0)
    if (totalQty >= 3 && item.wholesale_price && Number(item.wholesale_price) > 0) {
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
            <p>{t('heroGlass')}</p>
            <p className="hero-offices">{t('officeSochi')}</p>
            <p className="hero-phone">{t('heroPhone')}</p>
          </div>
          <a href="#catalog" className="hero-btn">{t('heroBtn')}</a>
          <div className="hero-contacts">
            <a href="https://max.ru/u/f9LHodD0cOKl_rlTV9a9EsXejDlc-Be7NLdhMcpCfu16AH6yJIUX5j9q9SM" target="_blank" className="glass-btn">
              <img src="/manager-sapa.jpg" alt="MAX" className="glass-avatar" />
              <span>{t('contactManager')}</span>
            </a>
            <a href="https://t.me/iuliiashimanskaia" target="_blank" className="glass-btn">
              <img src="/manager-tg.jpg" alt="Telegram" className="glass-avatar" />
              <span>{t('contactTelegram')}</span>
            </a>
            <a href="https://wa.me/79000008023" target="_blank" className="glass-btn">
              <svg className="glass-avatar" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{background:'#25D366',borderRadius:'50%',padding:6}}>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill="white"/>
              </svg>
              <span>{t('contactWhatsApp')}</span>
            </a>
          </div>
        </div>
      </section>

      <section className="supplier-banner">
        <div className="supplier-banner-inner">
          <span className="supplier-banner-icon">⚠️</span>
          <div className="supplier-banner-text">
            <strong>{t('supplierBannerTitle')}</strong>
            <p>{t('supplierBannerText')}</p>
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
                onPreorder={(p) => setPreorderModal(p)}
              />
            )
          })}
        </div>
      </section>

      <FAQ />

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
              if (remaining > 0) init[name] = 0
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

      <BottomNav onCartClick={() => setCartOpen(true)} />

      {/* Preorder modal */}
      {preorderModal && (
        <PreorderModal
          product={preorderModal}
          api={API}
          onClose={() => setPreorderModal(null)}
        />
      )}

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
                          <span className="color-picker-remain">{t('inStock')} {remaining} {t('pcs')}</span>
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
