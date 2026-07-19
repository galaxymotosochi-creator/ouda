import { useState } from 'react'
import { useLang } from '../i18n'

export default function ProductCard({ product, onAdd, inCart }) {
  const { t, translateColor } = useLang()
  const colors = product.colors || []
  const [selectedColor, setSelectedColor] = useState(0)

  const currentColor = colors[selectedColor]
  const displayImage = currentColor?.image || product.image || '/placeholder.svg'
  // use color-specific price if set, else base price
  const displayPrice = currentColor?.price ? Number(currentColor.price) : product.price

  const handleAdd = () => {
    onAdd({
      ...product,
      selectedColor: currentColor?.name || product.color,
      selectedHex: currentColor?.hex || '',
      image: displayImage,
      price: displayPrice,
    })
  }

  return (
    <div className="product-card">
      <img
        className="product-img"
        src={displayImage}
        alt={product.name}
        onError={(e) => { e.target.src = '/placeholder.svg' }}
      />
      <div className="product-body">
        <div className="product-name">{product.name}</div>
        <div className="product-specs">
          {colors.length > 0 ? (
            <span>🎨 {t('color')}:
              <strong>{translateColor(currentColor?.name || '')}</strong>
            </span>
          ) : (
            <span>🎨 {t('color')}: <strong>{translateColor(product.color)}</strong></span>
          )}
          <span>⚡ {t('power')}: <strong>{product.power}</strong></span>
          <span>🔘 {t('tires')}: <strong>{product.tires}</strong></span>
        </div>

        {colors.length > 1 && (
          <div className="color-swatches">
            {colors.map((c, i) => (
              <div
                key={i}
                className={`color-swatch ${i === selectedColor ? 'selected' : ''}`}
                style={{ background: c.hex }}
                onClick={() => setSelectedColor(i)}
                title={c.name}
              />
            ))}
          </div>
        )}

        <div className="product-price">
          {displayPrice.toLocaleString('ru-RU')} {t('rub')}
        </div>
        <button
          className={`product-add ${inCart ? 'in-cart' : ''}`}
          onClick={handleAdd}
        >
          {inCart ? t('inCart') : t('addToCart')}
        </button>
      </div>
    </div>
  )
}
