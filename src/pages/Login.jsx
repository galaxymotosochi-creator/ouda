import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const ADMIN_PASS = '8888'

export default function Login() {
  const [pin, setPin] = useState([])
  const [error, setError] = useState(false)
  const navigate = useNavigate()

  const handleDigit = (digit) => {
    if (pin.length >= 4) return
    setError(false)
    const newPin = [...pin, digit]
    setPin(newPin)

    if (newPin.length === 4) {
      const fullPin = newPin.join('')
      setTimeout(() => {
        if (fullPin === ADMIN_PASS) {
          sessionStorage.setItem('ouda_admin', 'true')
          navigate('/admin')
        } else {
          setError(true)
          setPin([])
        }
      }, 150)
    }
  }

  const handleDelete = () => {
    setError(false)
    setPin(prev => prev.slice(0, -1))
  }

  return (
    <div className="login-page">
      <div className="pin-box">
        <h2>Вход</h2>

        {/* Dots row */}
        <div className="pin-dots">
          {[0,1,2,3].map(i => (
            <div key={i} className={`pin-dot ${pin[i] ? 'filled' : ''} ${error ? 'shake' : ''}`} />
          ))}
        </div>

        {error && <div className="login-error">Неверный код</div>}

        {/* Keypad */}
        <div className="pin-keypad">
          {[1,2,3,4,5,6,7,8,9].map(d => (
            <button key={d} className="pin-key" onClick={() => handleDigit(String(d))}>
              {d}
            </button>
          ))}
          <div />
          <button className="pin-key" onClick={() => handleDigit('0')}>0</button>
          <button className="pin-key pin-key-del" onClick={handleDelete}>⌫</button>
        </div>
      </div>
    </div>
  )
}
