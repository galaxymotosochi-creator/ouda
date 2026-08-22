import { useState, useEffect } from 'react'
import { useLang } from '../i18n'

const API = import.meta.env.VITE_API_URL || ''
const TOKEN_KEY = 'ouda_agent_token'

const STATUS_LABELS = {
  new: 'Новый',
  talk: 'В переговорах',
  order: 'Заказ',
  sold: 'Продано',
  lost: 'Отказ',
}

const ORDER_STATUS = {
  new: 'Новый',
  accepted: 'В работе',
  paid: 'Оплачен',
  shipped: 'Отгружен',
  done: 'Завершён',
  cancelled: 'Отменён',
}

function fmt(n) {
  return Number(n || 0).toLocaleString('ru-RU')
}
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AgentPage() {
  const { t } = useLang()
  const [token, setToken] = useState(sessionStorage.getItem(TOKEN_KEY) || '')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const [tab, setTab] = useState('overview')
  const [data, setData] = useState(null)
  const [orders, setOrders] = useState([])
  const [clients, setClients] = useState([])
  const [tasks, setTasks] = useState([])
  const [notifs, setNotifs] = useState([])

  // Client form
  const [clientForm, setClientForm] = useState({ name: '', phone: '+7', city: '', status: 'new', note: '' })
  const [taskForm, setTaskForm] = useState({ client_id: '', text: '', due_date: '' })
  const [tgCode, setTgCode] = useState('')

  const loadAll = () => {
    if (!token) return
    const headers = { 'X-Agent-Token': token }
    fetch(`${API}/api/agent/me`, { headers }).then(r => r.json()).then(setData).catch(() => {})
    fetch(`${API}/api/agent/orders`, { headers }).then(r => r.json()).then(setOrders).catch(() => {})
    fetch(`${API}/api/agent/clients`, { headers }).then(r => r.json()).then(setClients).catch(() => {})
    fetch(`${API}/api/agent/tasks`, { headers }).then(r => r.json()).then(setTasks).catch(() => {})
    fetch(`${API}/api/agent/notifications`, { headers }).then(r => r.json()).then(setNotifs).catch(() => {})
  }

  useEffect(() => {
    if (token) {
      loadAll()
      const timer = setInterval(loadAll, 10000)
      return () => clearInterval(timer)
    }
  }, [token])

  const doLogin = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const r = await fetch(`${API}/api/agent/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.error === 'blocked' ? 'Агент заблокирован' : 'Неверный логин или пароль')
        return
      }
      const d = await r.json()
      sessionStorage.setItem(TOKEN_KEY, d.token)
      setToken(d.token)
    } catch {
      setError('Ошибка соединения')
    }
  }

  const logout = () => {
    sessionStorage.removeItem(TOKEN_KEY)
    setToken('')
    setData(null)
  }

  const markRead = () => {
    fetch(`${API}/api/agent/notifications/read`, { method: 'POST', headers: { 'X-Agent-Token': token } }).catch(() => {})
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  const addClient = async (e) => {
    e.preventDefault()
    if (!clientForm.name) return
    const r = await fetch(`${API}/api/agent/clients`, {
      method: 'POST',
      headers: { 'X-Agent-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(clientForm),
    }).catch(() => null)
    if (r && r.ok) {
      setClientForm({ name: '', phone: '+7', city: '', status: 'new', note: '' })
      loadAll()
    }
  }

  const updateClient = async (id, patch) => {
    await fetch(`${API}/api/agent/clients/${id}`, {
      method: 'PATCH',
      headers: { 'X-Agent-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => {})
    loadAll()
  }

  const deleteClient = async (id) => {
    if (!confirm('Удалить клиента?')) return
    await fetch(`${API}/api/agent/clients/${id}`, { method: 'DELETE', headers: { 'X-Agent-Token': token } }).catch(() => {})
    loadAll()
  }

  const addTask = async (e) => {
    e.preventDefault()
    if (!taskForm.text) return
    await fetch(`${API}/api/agent/tasks`, {
      method: 'POST',
      headers: { 'X-Agent-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(taskForm),
    }).catch(() => {})
    setTaskForm({ client_id: '', text: '', due_date: '' })
    loadAll()
  }

  const toggleTask = async (id, done) => {
    await fetch(`${API}/api/agent/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'X-Agent-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ done }),
    }).catch(() => {})
    loadAll()
  }

  const deleteTask = async (id) => {
    await fetch(`${API}/api/agent/tasks/${id}`, { method: 'DELETE', headers: { 'X-Agent-Token': token } }).catch(() => {})
    loadAll()
  }

  const requestTgCode = async () => {
    const r = await fetch(`${API}/api/agent/tg-code`, { method: 'POST', headers: { 'X-Agent-Token': token } }).then(r => r.json()).catch(() => ({}))
    if (r.code) setTgCode(r.code)
  }

  // Login screen
  if (!token) {
    return (
      <div className="agent-page">
        <div className="agent-login-box">
          <h2>Кабинет агента</h2>
          <form onSubmit={doLogin}>
            <input className="agent-input" placeholder="Логин" value={login} onChange={e => setLogin(e.target.value)} autoFocus />
            <input className="agent-input" placeholder="Пароль" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            {error && <div className="agent-error">{error}</div>}
            <button className="agent-btn agent-btn-primary" type="submit">Войти</button>
          </form>
          <a className="agent-back" href="/">На сайт</a>
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="agent-page agent-loading">Загрузка...</div>
  }

  const s = data.stats

  return (
    <div className="agent-page">
      <div className="admin-header agent-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2>Кабинет агента: {data.agent.name}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/" style={{ fontSize: 13, color: '#667eea' }}>На сайт</a>
          <button className="admin-logout" onClick={logout}>Выйти</button>
        </div>
      </div>

      <div className="admin-content">
        <div className="admin-tabs">
          {[
            { key: 'overview', label: 'Обзор' },
            { key: 'orders', label: `Заказы (${orders.length})` },
            { key: 'clients', label: `Клиенты (${clients.length})` },
            { key: 'tasks', label: `Напоминания (${tasks.filter(x => !x.done).length})` },
            { key: 'notifs', label: `Уведомления (${notifs.filter(n => !n.read).length})` },
          ].map(tabItem => (
            <button key={tabItem.key} className={`admin-tab ${tab === tabItem.key ? 'active' : ''}`}
              onClick={() => { setTab(tabItem.key); if (tabItem.key === 'notifs') markRead() }}>{tabItem.label}</button>
          ))}
        </div>

        {/* ОБЗОР */}
        {tab === 'overview' && (
          <div className="agent-overview">
            <div className="agent-link-card">
              <div className="agent-link-label">Ваша реферальная ссылка</div>
              <div className="agent-link-value">{data.link}</div>
              <button className="agent-btn" onClick={() => { navigator.clipboard.writeText(data.link); alert('Ссылка скопирована') }}>Копировать</button>
            </div>

            <div className="agent-stats-grid">
              <div className="agent-stat">
                <div className="agent-stat-label">Клики по ссылке</div>
                <div className="agent-stat-value">{s.clicks}</div>
              </div>
              <div className="agent-stat">
                <div className="agent-stat-label">Заказы</div>
                <div className="agent-stat-value">{s.orders.total}</div>
              </div>
              <div className="agent-stat">
                <div className="agent-stat-label">Клиенты в CRM</div>
                <div className="agent-stat-value">{s.clients}</div>
              </div>
              <div className="agent-stat">
                <div className="agent-stat-label">Потенциальный заработок</div>
                <div className="agent-stat-value">{fmt(s.potential)} ₽</div>
              </div>
              <div className="agent-stat agent-stat-accent">
                <div className="agent-stat-label">Фактический заработок (отгружено)</div>
                <div className="agent-stat-value">{fmt(s.actual)} ₽</div>
              </div>
            </div>

            <div className="agent-info-row">
              <span>Ставка: розница — {fmt(data.settings.retail_reward)} ₽, опт (3+ шт) — {fmt(data.settings.wholesale_reward)} ₽</span>
            </div>

            <div className="agent-tg-card">
              <div className="agent-link-label">Уведомления в Telegram</div>
              {data.tg_connected ? (
                <div className="agent-tg-ok">Telegram подключён — уведомления приходят автоматически</div>
              ) : (
                <>
                  <div className="agent-tg-hint">1. Нажмите «Получить код»</div>
                  <div className="agent-tg-hint">2. Напишите боту в Telegram: /start {tgCode || 'КОД'}</div>
                  <button className="agent-btn" onClick={requestTgCode}>{tgCode ? `Код: ${tgCode} (10 мин)` : 'Получить код'}</button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ЗАКАЗЫ */}
        {tab === 'orders' && (
          <div className="v2-card" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table" style={{ margin: 0 }}>
                <thead><tr>
                  <th>№</th><th>Дата</th><th>Клиент</th><th>Телефон</th><th>Город</th><th>Товары</th><th>Сумма</th><th>Тип</th><th>Вознаграждение</th><th>Статус</th>
                </tr></thead>
                <tbody>
                  {[...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((o, i) => (
                    <tr key={o.id}>
                      <td>{i + 1}</td>
                      <td>{fmtDate(o.created_at)}</td>
                      <td>{o.name}</td>
                      <td>{o.phone}</td>
                      <td>{o.city || '—'}</td>
                      <td style={{ minWidth: 200, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {(o.items || []).map(it => `${it.name} ×${it.qty}${it.color ? ' (' + it.color + ')' : ''}`).join(', ') || '—'}
                      </td>
                      <td>{fmt(o.total)} ₽</td>
                      <td>{o.reward.type === 'wholesale' ? 'Опт' : 'Розница'}</td>
                      <td>{o.status === 'cancelled' ? '—' : `+${fmt(o.reward.amount)} ₽`}</td>
                      <td>{ORDER_STATUS[o.status] || o.status}</td>
                    </tr>
                  ))}
                  {orders.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', color: '#666', padding: 40 }}>Заказов пока нет</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* КЛИЕНТЫ (мини-CRM) */}
        {tab === 'clients' && (
          <div className="agent-crm">
            <form className="agent-client-form" onSubmit={addClient}>
              <input className="agent-input" placeholder="Имя *" value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} required />
              <input className="agent-input" placeholder="Телефон" value={clientForm.phone} onChange={e => setClientForm({ ...clientForm, phone: e.target.value })} />
              <input className="agent-input" placeholder="Город" value={clientForm.city} onChange={e => setClientForm({ ...clientForm, city: e.target.value })} />
              <select className="agent-input" value={clientForm.status} onChange={e => setClientForm({ ...clientForm, status: e.target.value })}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input className="agent-input" placeholder="Заметка" value={clientForm.note} onChange={e => setClientForm({ ...clientForm, note: e.target.value })} />
              <button className="agent-btn agent-btn-primary" type="submit">Добавить клиента</button>
            </form>

            <div className="v2-card" style={{ overflow: 'hidden', padding: 0, marginTop: 16 }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table" style={{ margin: 0 }}>
                  <thead><tr>
                    <th>Клиент</th><th>Телефон</th><th>Город</th><th>Источник</th><th>Статус</th><th>Заметка</th><th>Добавлен</th><th></th>
                  </tr></thead>
                  <tbody>
                    {clients.map(c => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.phone}</td>
                        <td>{c.city || '—'}</td>
                        <td>{c.source === 'site' ? 'С сайта' : 'Свой'}</td>
                        <td>
                          <select className="agent-input agent-input-sm" value={c.status} onChange={e => updateClient(c.id, { status: e.target.value })}>
                            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </td>
                        <td style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{c.note || '—'}</td>
                        <td>{fmtDate(c.created_at)}</td>
                        <td>
                          <button className="agent-btn agent-btn-danger" onClick={() => deleteClient(c.id)}>Удалить</button>
                        </td>
                      </tr>
                    ))}
                    {clients.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#666', padding: 40 }}>Клиентов пока нет</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* НАПОМИНАНИЯ */}
        {tab === 'tasks' && (
          <div className="agent-crm">
            <form className="agent-client-form" onSubmit={addTask}>
              <select className="agent-input" value={taskForm.client_id} onChange={e => setTaskForm({ ...taskForm, client_id: e.target.value })}>
                <option value="">— Клиент (необязательно) —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input className="agent-input" placeholder="Что сделать? *" value={taskForm.text} onChange={e => setTaskForm({ ...taskForm, text: e.target.value })} required />
              <input className="agent-input" type="date" value={taskForm.due_date} onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })} />
              <button className="agent-btn agent-btn-primary" type="submit">Добавить напоминание</button>
            </form>

            <div className="v2-card" style={{ overflow: 'hidden', padding: 0, marginTop: 16 }}>
              <table className="admin-table" style={{ margin: 0 }}>
                <thead><tr><th>Задача</th><th>Клиент</th><th>Срок</th><th>Статус</th><th></th></tr></thead>
                <tbody>
                  {tasks.map(tk => {
                    const c = clients.find(c => c.id === tk.client_id)
                    return (
                      <tr key={tk.id} style={{ opacity: tk.done ? 0.5 : 1 }}>
                        <td>{tk.text}</td>
                        <td>{c ? c.name : '—'}</td>
                        <td>{tk.due_date || '—'}</td>
                        <td>
                          <button className={`agent-btn ${tk.done ? 'agent-btn-ghost' : 'agent-btn-primary'}`}
                            onClick={() => toggleTask(tk.id, !tk.done)}>
                            {tk.done ? 'Выполнено' : 'Отметить'}
                          </button>
                        </td>
                        <td><button className="agent-btn agent-btn-danger" onClick={() => deleteTask(tk.id)}>Удалить</button></td>
                      </tr>
                    )
                  })}
                  {tasks.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#666', padding: 40 }}>Напоминаний пока нет</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* УВЕДОМЛЕНИЯ */}
        {tab === 'notifs' && (
          <div className="v2-card" style={{ overflow: 'hidden', padding: 0 }}>
            {notifs.length === 0 && <div style={{ textAlign: 'center', color: '#666', padding: 40 }}>Уведомлений пока нет</div>}
            {notifs.map(n => (
              <div key={n.id} className={`agent-notif ${n.read ? '' : 'agent-notif-unread'}`}>
                <div>{n.text}</div>
                <div className="agent-notif-date">{fmtDate(n.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
