import { useState } from 'react'
import { useLang } from '../i18n'

export default function ProductCard({ product, onAdd, inCart }) {
  const { t, translateColor } = useLang()
  const colors = product.colors || []
  const hasColors = colors.length > 0

  const handleClick = () => {
    if (hasColors && colors.length > 1) {
      onAdd(product, true) // true = open color picker
    } else {
      onAdd({
        ...product,
        selectedColor: hasColors ? colors[0].name : (product.color || ''),
        selectedHex: hasColors ? colors[0].hex : '',
        image: product.image || '/placeholder.svg',
        price: product.price,
      }, false)
    }
  }

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
          <span>{t('color')}: <strong>
            {hasColors
              ? colors.map(c => translateColor(c.name)).join(', ')
              : translateColor(product.color || '—')}
          </strong></span>
          <span>{t('power')}: <strong>{product.power}</strong></span>
          <span>{t('tires')}: <strong>{product.tires}</strong></span>
        </div>

        {hasColors && (
          <div className="color-swatches">
            {colors.map((c, i) => (
              <div
                key={i}
                className={`color-swatch-display ${c.hex === 'chameleon' ? 'color-swatch-chameleon' : ''}`}
                style={c.hex !== 'chameleon' ? { background: c.hex } : {}}
                title={c.name}
              />
            ))}
          </div>
        )}

        <div className="product-price">
          {product.price.toLocaleString('ru-RU')} {t('rub')}
        </div>
        <button
          className={`product-add ${inCart ? 'in-cart' : ''}`}
          onClick={handleClick}
        >
          {inCart ? t('inCart') : t('addToCart')}
        </button>
      </div>
    </div>
  )
}
