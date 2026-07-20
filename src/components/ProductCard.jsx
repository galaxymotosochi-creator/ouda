import { useState } from 'react'
import { useLang } from '../i18n'

export default function ProductCard({ product, onAdd, inCart }) {
  const { t, translateColor } = useLang()
  const colors = product.colors || []
  const hasColors = colors.length > 0

  const handleClick = () => {
    if (hasColors && colors.length > 1) {
      onAdd(product, true)
    } else {
      onAdd({
        ...product,
        selectedColor: hasColors ? colors[0].name : (product.color || ''),
        selectedHex: hasColors ? colors[0].hex : '',
        image: product.images?.[0] || product.image || '/placeholder.svg',
        price: product.price,
      }, false)
    }
  }

  return (
    <div className="product-card">
      <img
        className="product-img"
        src={product.images?.[0] || product.image || '/placeholder.svg'}
        alt={product.name}
        onError={(e) => { e.target.src = '/placeholder.svg' }}
      />
      <div className="product-body">
        <div className="product-name">{product.name}</div>

        {/* Colors — comma separated */}
        {hasColors && (
          <div className="product-colors">
            <span className="spec-label">{t('color')}:</span>
            <strong>{colors.map(c => translateColor(c.name)).join(', ')}</strong>
          </div>
        )}

        {/* Specs list */}
        <div className="product-specs">
          <span className="spec-label">{t('power')}:</span> <strong>{product.power}</strong>
          <span className="spec-label">{t('fuel')}:</span> <strong>{product.fuel}</strong>
          <span className="spec-label">{t('cooling')}:</span> <strong>{product.cooling}</strong>
          <span className="spec-label">{t('max_speed')}:</span> <strong>{product.max_speed}</strong>
          <span className="spec-label">{t('wheels')}:</span> <strong>{product.wheels}</strong>
        </div>

        {product.description && (
          <div className="product-desc">{product.description}</div>
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
