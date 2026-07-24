import { useState } from 'react'
import { useLang } from '../i18n'

export default function FAQ() {
  const { t } = useLang()
  const [openIdx, setOpenIdx] = useState(null)

  const toggle = (idx) => {
    setOpenIdx(openIdx === idx ? null : idx)
  }

  const blocks = [
    {
      title: t('faqDelivery'),
      questions: [
        { q: t('faqQ1'), a: t('faqA1') },
        { q: t('faqQ2'), a: t('faqA2') },
        { q: t('faqQ3'), a: t('faqA3') },
        { q: t('faqQ4'), a: t('faqA4') },
      ]
    },
    {
      title: t('faqPayment'),
      questions: [
        { q: t('faqQ5'), a: t('faqA5') },
        { q: t('faqQ6'), a: t('faqA6') },
        { q: t('faqQ7'), a: t('faqA7') },
      ]
    },
    {
      title: t('faqWholesale'),
      questions: [
        { q: t('faqQ8'), a: t('faqA8') },
        { q: t('faqQ9'), a: t('faqA9') },
        { q: t('faqQ10'), a: t('faqA10') },
      ]
    },
    {
      title: t('faqOrder'),
      questions: [
        { q: t('faqQ11'), a: t('faqA11') },
        { q: t('faqQ12'), a: t('faqA12') },
      ]
    },
    {
      title: t('faqDocs'),
      questions: [
        { q: t('faqQ13'), a: t('faqA13') },
        { q: t('faqQ14'), a: t('faqA14') },
        { q: t('faqQ15'), a: t('faqA15') },
      ]
    }
  ]

  return (
    <section className="faq" id="faq">
      <h2 className="faq-title">{t('faqTitle')}</h2>

      {(() => {
        let globalIdx = 0
        return blocks.map((block, bi) => (
          <div key={bi} className="faq-block">
            <h3 className="faq-block-title">{block.title}</h3>
            {block.questions.map((item, qi) => {
              const idx = globalIdx++
              const isOpen = openIdx === idx
              return (
                <div key={qi} className={`faq-item ${isOpen ? 'open' : ''}`}>
                  <button className="faq-question" onClick={() => toggle(idx)}>
                    <span className="faq-icon">{isOpen ? '−' : '+'}</span>
                    <span>{item.q}</span>
                  </button>
                  <div className={`faq-answer ${isOpen ? 'open' : ''}`}>
                    <div className="faq-answer-inner">{item.a}</div>
                  </div>
                </div>
              )
            })}
          </div>
        ))
      })()}
    </section>
  )
}
