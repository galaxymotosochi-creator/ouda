export default function ProductCard({ product, onAdd, inCart }) {
  return (
    <div className="product-card">
      <img
        className="product-img"
        src={product.image || '/placeholder.svg'}
        alt={product.name}
        onError={(e) => { e.target.src = '/placeholder.svg' }}
      />
      <div className="product-body">
        <div className="product-name">{product.name}</div>
        <div className="product-specs">
          <span>🎨 Цвет: <strong>{product.color}</strong></span>
          <span>⚡ Мощность: <strong>{product.power}</strong></span>
          <span>🔘 Резина: <strong>{product.tires}</strong></span>
        </div>
        <div className="product-price">
          {product.price.toLocaleString('ru-RU')} ₽
        </div>
        <button
          className={`product-add ${inCart ? 'in-cart' : ''}`}
          onClick={() => onAdd(product)}
        >
          {inCart ? '✓ В корзине' : 'В корзину'}
        </button>
      </div>
    </div>
  )
}
