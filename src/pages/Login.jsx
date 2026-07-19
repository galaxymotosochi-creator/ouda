import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const ADMIN_PASS = 'ouda2026'

export default function Login() {
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
        <h2>Вход в админку</h2>
        {error && <div className="login-error">Неверный пароль</div>}
        <input
          type="password"
          placeholder="Пароль"
          value={pass}
          onChange={e => { setPass(e.target.value); setError(false) }}
          autoFocus
        />
        <button type="submit">Войти</button>
      </form>
    </div>
  )
}
