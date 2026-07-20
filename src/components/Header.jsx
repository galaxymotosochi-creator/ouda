import { useLang } from '../i18n'

export default function Header({ cartCount, onCartClick }) {
  const { lang, setLang, t } = useLang()

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo">OUDA</div>
        <div className="lang-switch">
          <button
            className={`lang-btn ${lang === 'ru' ? 'active' : ''}`}
            onClick={() => setLang('ru')}
          >
            RU
          </button>
          <button
            className={`lang-btn ${lang === 'zh' ? 'active' : ''}`}
            onClick={() => setLang('zh')}
          >
            中文
          </button>
        </div>
      </div>
      <button className="header-cart-btn" onClick={onCartClick}>
        🛒 {t('cart')}
        {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
      </button>
    </header>
  )
}
