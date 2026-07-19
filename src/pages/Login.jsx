import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../i18n'

const ADMIN_PASS = 'ouda2026'

export default function Login() {
  const { t } = useLang()
  const [pass, setPass] = useState('')
  const [error, setError] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (pass === ADMIN_PASS) {
      sessionStorage.setItem('ouda_admin', 'true')
      navigate('/admin')
    } else {
      setError(true)
    }
  }

  return (
    <div className="login-page">
      <form className="login-box" onSubmit={handleSubmit}>
        <h2>{t('loginTitle')}</h2>
        {error && <div className="login-error">{t('loginError')}</div>}
        <input type="password" placeholder="••••••" value={pass}
          onChange={e => { setPass(e.target.value); setError(false) }} autoFocus />
        <button type="submit">{t('loginBtn')}</button>
      </form>
    </div>
  )
}
