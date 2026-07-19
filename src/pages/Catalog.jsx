import { useState, useEffect, useCallback } from 'react'
import { useLang } from '../i18n'
import { PRESET_COLORS } from '../colors'
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
  const [colorModal, setColorModal] = useState(null) // { product, callback }

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
      // Show color picker
      setColorModal({
        product,
        colors: product.colors,
      })
    } else {
      const firstColor = product.colors?.[0]
      addToCart(product, firstColor?.name || product.color, firstColor?.hex || '')
    }
  }

  const handleColorSelect = (colorName, colorHex) => {
    if (!colorModal) return
    addToCart(colorModal.product, colorName, colorHex)
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

      <section className="hero">
        <h1>{t('heroTitle')}</h1>
        <p>{t('heroDesc')}</p>
        <a href="#catalog" className="hero-btn">{t('heroBtn')}</a>
      </section>

      <section className="catalog" id="catalog">
        <h2>{t('catalogTitle')}</h2>
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
          if (product?.colors?.length > 1) {
            setColorModal({ product, colors: product.colors })
          } else {
            // Single color — just add another of same
            addToCart(product, item.selectedColor || product.color, item.selectedHex || '')
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
            <h4>Выберите цвет</h4>
            <div className="palette">
              {(colorModal.colors || []).map(c => (
                <div
                  key={c.name}
                  className={`palette-color ${c.hex === 'chameleon' ? 'color-swatch-chameleon' : ''}`}
                  style={c.hex !== 'chameleon' ? { background: c.hex } : {}}
                  onClick={() => handleColorSelect(c.name, c.hex)}
                  title={c.name}
                />
              ))}
            </div>
            <div>
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
