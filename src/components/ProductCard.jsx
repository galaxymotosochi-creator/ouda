import { useState } from 'react'
import { useLang } from '../i18n'
import { PRESET_COLORS, getColorHex } from '../colors'

export default function ProductCard({ product, onAdd, inCart }) {
  const { t, lang, translateColor } = useLang()
  const availColors = product.available_colors || {}
  const colorNames = Object.keys(availColors).filter(name => availColors[name] > 0)
  const hasColors = colorNames.length > 0

  const handleClick = () => {
    if (hasColors && colorNames.length > 1) {
      onAdd(product, true)
    } else {
      const firstName = hasColors ? colorNames[0] : ''
      onAdd({
        ...product,
        selectedColor: firstName,
        selectedHex: getColorHex(firstName),
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
        <div className="product-name">{lang === 'zh' ? (product.name_zh || product.name) : (product.name_ru || product.name)}</div>

        {/* Colors from stock — comma separated with quantities */}
        {hasColors && (
          <div className="product-colors">
            <span className="spec-label">{t('color')}:</span>
            <strong>{colorNames.map(name => `${translateColor(name)} (${availColors[name]})`).join(', ')}</strong>
          </div>
        )}

        {/* Specs list */}
        <div className="product-specs">
          <span className="spec-label">{t('power')}:</span> <strong>{product.power}</strong>
          <span className="spec-label">{t('fuel')}:</span> <strong>{product.fuel === 'Карбюратор' ? t('carburetor') : product.fuel === 'Инжектор' ? t('injector') : product.fuel}</strong>
          <span className="spec-label">{t('cooling')}:</span> <strong>{product.cooling === 'Воздушное' ? t('airCooled') : product.cooling === 'Жидкостное' ? t('liquidCooled') : product.cooling}</strong>
          <span className="spec-label">{t('max_speed')}:</span> <strong>{product.max_speed}</strong>
          <span className="spec-label">{t('wheels')}:</span> <strong>{product.wheels}</strong>
        </div>

        {product.description && (
          <div className="product-desc">{product.description}</div>
        )}

        <div className="product-price">
          <div><span className="price-label">Розничная:</span> {product.price.toLocaleString('ru-RU')} {t('rub')}</div>
          <div><span className="price-label">Оптовая:</span> {product.wholesale_price ? Number(product.wholesale_price).toLocaleString('ru-RU') + ' ' + t('rub') : '—'}</div>
        </div>
        <div style={{textAlign:'right'}}>
        <button
          className={`product-add ${inCart ? 'in-cart' : ''}`}
          onClick={handleClick}
        >
          {inCart ? t('inCart') : t('addToCart')}
        </button>
        </div>
      </div>
    </div>
  )
}
