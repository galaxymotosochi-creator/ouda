import { useLang } from '../i18n'

export default function ProductCard({ product, onAdd, inCart }) {
  const { t, translateColor } = useLang()

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
          <span>🎨 {t('color')}: <strong>{translateColor(product.color)}</strong></span>
          <span>⚡ {t('power')}: <strong>{product.power}</strong></span>
          <span>🔘 {t('tires')}: <strong>{product.tires}</strong></span>
        </div>
        <div className="product-price">
          {product.price.toLocaleString('ru-RU')} {t('rub')}
        </div>
        <button
          className={`product-add ${inCart ? 'in-cart' : ''}`}
          onClick={() => onAdd(product)}
        >
          {inCart ? t('inCart') : t('addToCart')}
        </button>
      </div>
    </div>
  )
}
