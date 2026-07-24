import { useLang } from '../i18n'

export default function BottomNav({ onCartClick }) {
  const { t } = useLang()
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        <a href="#catalog" className="bottom-nav-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <span className="bottom-nav-label">{t('bottomCatalog')}</span>
        </a>
        <span className="bottom-nav-sep">|</span>
        <button className="bottom-nav-item" onClick={onCartClick}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          <span className="bottom-nav-label">{t('bottomCart')}</span>
        </button>
        <span className="bottom-nav-sep">|</span>
        <a href="https://max.ru/u/f9LHodD0cOKl_rlTV9a9EsXejDlc-Be7NLdhMcpCfu16AH6yJIUX5j9q9SM" target="_blank" className="bottom-nav-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="bottom-nav-label">{t('contactManager')}</span>
        </a>
        <span className="bottom-nav-sep">|</span>
        <a href="https://t.me/iuliiashimanskaia" target="_blank" className="bottom-nav-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 2 11 13" />
            <path d="M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
          <span className="bottom-nav-label">{t('contactTelegram')}</span>
        </a>
        <span className="bottom-nav-sep">|</span>
        <a href="#faq" className="bottom-nav-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="bottom-nav-label">{t('bottomFaq')}</span>
        </a>
      </div>
    </nav>
  )
}
