import { useState } from 'react'
import { useLang } from '../i18n'
import { PRESET_COLORS, getColorHex } from '../colors'

export default function ProductCard({ product, onAdd, inCart, cartQtys, onPreorder }) {
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

  // Check if product has ANY stock at all (received, not just in transit)
  const totalAvailable = Object.values(avail).reduce((s, v) => s + v, 0)
  const isOutOfStock = totalAvailable === 0 && totalInCart === 0

  // Incoming shipments info
  const hasIncoming = product.incoming && product.incoming.length > 0
  const earliestDate = product.expected_date

  const handleClick = () => {
    if (!canAddAny) return
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
    if (isOutOfStock) return 'Сообщить о наличии'
    if (!canAddAny && totalInCart > 0) return '✓ ' + t('inCart')
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

        {/* Out of stock badge */}
        {isOutOfStock && (
          <div className="out-of-stock-badge">
            <span>📦</span>
            <div className="out-of-stock-text">
              {t('outOfStock')}
              {earliestDate && <span className="out-of-stock-date">{t('outOfStockDate')} {new Date(earliestDate).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'ru-RU')}</span>}
            </div>
          </div>
        )}

        {/* Colors from stock — pill badges */}
        {!isOutOfStock && (
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
        )}

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
          {!isOutOfStock ? (
            <>
              <div><span className="price-label">Розничная:</span> <span className="price-value">{product.price.toLocaleString('ru-RU')} {t('rub')}</span></div>
              <div><span className="price-label">Оптовая:</span> <span className="price-value">{product.wholesale_price ? Number(product.wholesale_price).toLocaleString('ru-RU') + ' ' + t('rub') : '—'}</span></div>
              <div className="wholesale-pill">Оптовая цена от 3 шт</div>
            </>
          ) : (
            <>
              <div><span className="price-label">{t('priceLastRetail')}</span> <span className="price-value">{product.price.toLocaleString('ru-RU')} {t('rub')}</span></div>
              <div><span className="price-label">{t('priceLastWholesale')}</span> <span className="price-value">{product.wholesale_price ? Number(product.wholesale_price).toLocaleString('ru-RU') + ' ' + t('rub') : '—'}</span></div>
            </>
          )}
        </div>
        <div style={{textAlign:'right', marginTop:'auto'}}>
          {isOutOfStock ? (
            <button className="product-add preorder-btn" onClick={() => onPreorder(product)}>
              {t('preorderBtn')}
            </button>
          ) : (
            <button
              className={`product-add ${(inCart || totalInCart > 0) && canAddAny ? 'in-cart' : ''} ${!canAddAny ? 'disabled' : ''}`}
              onClick={handleClick}
              disabled={!canAddAny}
            >
              {getButtonText()}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
