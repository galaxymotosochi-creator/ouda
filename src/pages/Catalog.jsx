import { useState, useEffect } from 'react'
import Header from '../components/Header'
import Cart from '../components/Cart'
import ProductCard from '../components/ProductCard'

const API = import.meta.env.VITE_API_URL || ''

export default function Catalog() {
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    fetch(`${API}/api/products`)
      .then(r => r.json())
      .then(setProducts)
      .catch(() => {
        // fallback demo data
        setProducts([
          { id: 1, name: 'OUDA Street 50', price: 79900, image: '/scooter1.jpg', color: 'Чёрный', power: '50cc', tires: '10"', description: 'Городской скутер 50cc' },
          { id: 2, name: 'OUDA Sport 125', price: 129900, image: '/scooter2.jpg', color: 'Красный', power: '125cc', tires: '12"', description: 'Спортивный скутер 125cc' },
          { id: 3, name: 'OUDA Electric', price: 99900, image: '/scooter3.jpg', color: 'Белый', power: '2000W', tires: '10"', description: 'Электроскутер 2000W' },
        ])
      })
  }, [])

  const addToCart = (product) => {
    setCart(prev => {
      const exists = prev.find(item => item.id === product.id)
      if (exists) {
        return prev.map(item =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        )
      }
      return [...prev, { ...product, qty: 1 }]
    })
  }

  const updateQty = (id, delta) => {
    setCart(prev =>
      prev.map(item =>
        item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item
      )
    )
  }

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  const totalItems = cart.reduce((s, i) => s + i.qty, 0)
  const totalSum = cart.reduce((s, i) => s + i.price * i.qty, 0)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <>
      <Header
        cartCount={totalItems}
        onCartClick={() => setCartOpen(true)}
      />

      <section className="hero">
        <h1>OUDA <span>Скутеры</span></h1>
        <p>Стильные и надёжные скутеры для города. Качество, скорость, доступная цена.</p>
        <a href="#catalog" className="hero-btn">Смотреть каталог</a>
      </section>

      <section className="catalog" id="catalog">
        <h2>Каталог</h2>
        <div className="catalog-grid">
          {products.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onAdd={addToCart}
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
        api={API}
        onSuccess={() => {
          setCart([])
          setCartOpen(false)
          showToast('Спасибо! Заказ отправлен, мы свяжемся с вами 🏍️')
        }}
      />

      {toast && <div className="success-toast">{toast}</div>}
    </>
  )
}
