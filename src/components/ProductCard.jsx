import { useState } from 'react'
import { useLang } from '../i18n'
import { PRESET_COLORS, getColorHex } from '../colors'

export default function ProductCard({ product, onAdd, inCart, cartQtys }) {
  const { t, lang, translateColor } = useLang()
  const avail = product.available_colors || {}
  const colorNames = Object.keys(avail).filter(name => avail[name] > 0)
  const hasColors = colorNames.length > 0

  // Check if any color still has stock available (not already in cart)
  const canAddAny = colorNames.some(name => {
    const stock = avail[name] || 0
    const inCartQty = (cartQtys || {})[`${product.id}_${name}`] || 0
    return stock > inCartQty
  })

  // Total in cart across all colors of this product
  const totalInCart = Object.entries(cartQtys || {})
    .filter(([key]) => key.startsWith(`${product.id}_`))
    .reduce((s, [, qty]) => s + qty, 0)

  const handleClick = () => {
    if (!canAddAny) return // no stock left, do nothing

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

  const getButtonText = () => {
    if (!canAddAny && totalInCart > 0) return '✓ ' + t('inCart')
    if (!canAddAny && totalInCart === 0) return 'Нет в наличии'
    if (totalInCart > 0) return `+1 (в корзине ${totalInCart})`
    return t('addToCart')
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

        {/* Colors from stock — pill badges */}
        <div className="product-colors">
          {hasColors ? (
            <>
              <span className="spec-label" style={{marginBottom:6,display:'inline-block'}}>{t('color')}:</span>
              <div className="color-pills">
                {colorNames.map(name => {
                  const stock = avail[name] || 0
                  const inCartQty = (cartQtys || {})[`${product.id}_${name}`] || 0
                  const remaining = stock - inCartQty
                  return (
                    <span key={name} className="color-pill">
                      {translateColor(name)} {remaining} шт
                    </span>
                  )
                })}
              </div>
            </>
          ) : (
            <span style={{visibility:'hidden'}}> </span>
          )}
        </div>

        {/* Specs list */}
        <div className="product-specs">
          <span className="spec-label">{t('power')}:</span> <strong>{product.power}</strong>
          <span className="spec-label">{t('fuel')}:</span> <strong>{product.fuel === 'Карбюратор' ? t('carburetor') : product.fuel === 'Инжектор' ? t('injector') : product.fuel}</strong>
          <span className="spec-label">{t('cooling')}:</span> <strong>{product.cooling === 'Воздушное' ? t('airCooled') : product.cooling === 'Жидкостное' ? t('liquidCooled') : product.cooling}</strong>
          <span className="spec-label">{t('max_speed')}:</span> <strong>{product.max_speed}{!String(product.max_speed).includes('км') ? ' км/ч' : ''}</strong>
          <span className="spec-label">{t('wheels')}:</span> <strong>{product.wheels}</strong>
        </div>

        {product.description && (
          <div className="product-desc">{product.description}</div>
        )}

        <div className="product-price">
          <div><span className="price-label">Розничная:</span> {product.price.toLocaleString('ru-RU')} {t('rub')}</div>
          <div><span className="price-label">Оптовая:</span> {product.wholesale_price ? Number(product.wholesale_price).toLocaleString('ru-RU') + ' ' + t('rub') : '—'}</div>
          <div className="wholesale-pill">Оптовая цена от 2 шт</div>
        </div>
        <div style={{textAlign:'right', marginTop:'auto'}}>
          <button
            className={`product-add ${(inCart || totalInCart > 0) && canAddAny ? 'in-cart' : ''} ${!canAddAny ? 'disabled' : ''}`}
            onClick={handleClick}
            disabled={!canAddAny}
          >
            {getButtonText()}
          </button>
        </div>
      </div>
    </div>
  )
}
