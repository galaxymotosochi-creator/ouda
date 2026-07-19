import '../styles/global.css'

export default function Header({ cartCount, onCartClick }) {
  return (
    <header className="header">
      <div className="header-logo">OUDA<span>.</span></div>
      <button className="header-cart-btn" onClick={onCartClick}>
        🛒 Корзина
        {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
      </button>
    </header>
  )
}
