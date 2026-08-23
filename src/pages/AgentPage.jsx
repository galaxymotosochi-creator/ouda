import { useState, useEffect } from 'react'
import { useLang } from '../i18n'

const API = import.meta.env.VITE_API_URL || ''
const TOKEN_KEY = 'ouda_agent_token'

const STATUS_LABELS = {
  new: 'Новый',
  talk: 'В переговорах',
  prepaid: 'Внесена предоплата',
  lost: 'Отказ',
  order: 'Заказ', // старые клиенты с сайта
  sold: 'Продано', // после завершения заказа
}

// Стандартные цвета НЕ используем — цвета берутся со склада (stock/available)
const itemLabel = (it) => `${it.name}${it.color ? ` — ${it.color}` : ''} (${it.qty})`

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
  const [clientForm, setClientForm] = useState({ name: '', phone: '+7', city: '', source: '', status: 'new', note: '', prepaid_amount: '', items: [] })
  const [taskForm, setTaskForm] = useState({ client_id: '', text: '', due_date: '' })
  const [tgCode, setTgCode] = useState('')
  const [products, setProducts] = useState([])
  const [stock, setStock] = useState({})
  const [itemForm, setItemForm] = useState({ product_id: '', color: '', qty: 1 })
  const [prepaidModal, setPrepaidModal] = useState(null) // { client, amount }

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

  useEffect(() => {
    fetch(`${API}/api/products`).then(r => r.json()).then(setProducts).catch(() => {})
    fetch(`${API}/api/stock/available`).then(r => r.json()).then(setStock).catch(() => {})
  }, [])

  // Цвета модели — только те, что реально есть на складе (остаток > 0)
  const getStockColors = (productId) => {
    if (!productId) return []
    const prefix = `${productId}:`
    return Object.entries(stock)
      .filter(([k, v]) => k.startsWith(prefix) && Number(v) > 0)
      .map(([k]) => k.slice(prefix.length))
  }
  const stockQty = (productId, color) => Number(stock[`${productId}:${color}`] || 0)

  const clientPot = (items) => {
    const qty = (items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0)
    if (!qty) return 0
    return qty >= 3 ? (data ? (data.settings.wholesale_reward || 2500) : 2500) : (data ? (data.settings.retail_reward || 7500) : 7500)
  }

  const addItem = () => {
    if (!itemForm.product_id) return
    const p = products.find(x => String(x.id) === String(itemForm.product_id))
    if (!p) return
    const color = itemForm.color || ''
    const qty = Number(itemForm.qty) || 1
    const exists = clientForm.items.find(i => String(i.product_id) === String(itemForm.product_id) && (i.color || '') === color)
    if (exists) {
      setClientForm({ ...clientForm, items: clientForm.items.map(i => (String(i.product_id) === String(itemForm.product_id) && (i.color || '') === color) ? { ...i, qty: (Number(i.qty) || 0) + qty } : i) })
    } else {
      setClientForm({ ...clientForm, items: [...clientForm.items, { product_id: p.id, name: p.name, color, qty }] })
    }
    setItemForm({ product_id: '', color: '', qty: 1 })
  }

  const removeItem = (idx) => setClientForm({ ...clientForm, items: clientForm.items.filter((_, i) => i !== idx) })

  const addClient = async (e) => {
    e.preventDefault()
    if (!clientForm.name) return
    if (clientForm.status === 'prepaid' && !(Number(clientForm.prepaid_amount) > 0)) {
      alert('Укажите сумму предоплаты')
      return
    }
    const r = await fetch(`${API}/api/agent/clients`, {
      method: 'POST',
      headers: { 'X-Agent-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...clientForm, prepaid_amount: Number(clientForm.prepaid_amount) || 0 }),
    }).catch(() => null)
    if (r && r.ok) {
      setClientForm({ name: '', phone: '+7', city: '', source: '', status: 'new', note: '', prepaid_amount: '', items: [] })
      setItemForm({ product_id: '', color: '', qty: 1 })
      loadAll()
    }
  }

  // Смена статуса в таблице: «предоплата» требует ввода суммы
  const onStatusChange = (c, val) => {
    if (val === 'prepaid') { setPrepaidModal({ client: c, amount: c.prepaid_amount || '' }); return }
    updateClient(c.id, { status: val })
  }
  const confirmPrepaid = () => {
    const amount = Number(prepaidModal.amount)
    if (!amount || amount <= 0) { alert('Введите сумму предоплаты'); return }
    updateClient(prepaidModal.client.id, { status: 'prepaid', prepaid_amount: amount })
    setPrepaidModal(null)
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
      body: JSON.stringify({ ...taskForm, client_id: taskForm.client_id ? Number(taskForm.client_id) : null }),
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
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="agent-page agent-loading">Загрузка...</div>
  }

  const s = data.stats
  const potClients = clients.filter(c => c.status === 'new' || c.status === 'talk')

  return (
    <div className="agent-page">
      <div className="admin-header agent-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2>Кабинет агента: {data.agent.name}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href={`/?ref=${data.agent.code}`} style={{ fontSize: 13, color: '#667eea' }}>На сайт</a>
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
                <div className="agent-stat-value">{fmt(s.potential + potClients.reduce((sum, c) => sum + clientPot(c.items), 0))} ₽</div>
                <div style={{ fontSize: 11, color: '#999' }}>столько вы сможете заработать при закрытии всех клиентов</div>
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
                  <div className="agent-tg-hint">Подключите Telegram, чтобы получать уведомления о заказах и клиентах</div>
                  {tgCode ? (
                    <>
                      <div className="agent-tg-hint">Ваш код: <strong style={{fontSize:16}}>{tgCode}</strong></div>
                      <a className="agent-btn agent-btn-primary" style={{textDecoration:'none',display:'inline-block'}}
                        href={`https://t.me/myouda_bot?start=${tgCode}`} target="_blank" rel="noreferrer">
                        Подключить Telegram
                      </a>
                      <div className="agent-tg-hint" style={{fontSize:12,color:'#999'}}>Если ссылка не сработала — напишите боту @myouda_bot вручную <strong>одним сообщением</strong>: <code>/start {tgCode}</code> (команду и код — вместе, в одну строку)</div>
                    </>
                  ) : (
                    <button className="agent-btn" onClick={requestTgCode}>Получить код</button>
                  )}
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
              <div className="agent-crm-grid">
                <input className="agent-input" placeholder="Имя *" value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} required />
                <input className="agent-input" placeholder="Телефон" value={clientForm.phone} onChange={e => setClientForm({ ...clientForm, phone: e.target.value })} />
                <input className="agent-input" placeholder="Город" value={clientForm.city} onChange={e => setClientForm({ ...clientForm, city: e.target.value })} />
                <input className="agent-input" placeholder="Источник (откуда клиент: Инстаграм, знакомые…)" value={clientForm.source} onChange={e => setClientForm({ ...clientForm, source: e.target.value })} />
                <select className="agent-input" value={clientForm.status} onChange={e => setClientForm({ ...clientForm, status: e.target.value })}>
                  {Object.entries(STATUS_LABELS).filter(([k]) => !['order', 'sold'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {clientForm.status === 'prepaid' && (
                  <input className="agent-input" type="number" min="1" placeholder="Сумма предоплаты (₽)" value={clientForm.prepaid_amount} onChange={e => setClientForm({ ...clientForm, prepaid_amount: e.target.value })} />
                )}
              </div>
              <input className="agent-input" placeholder="Заметка" value={clientForm.note} onChange={e => setClientForm({ ...clientForm, note: e.target.value })} />
              <div className="agent-item-row">
                <select className="agent-input" value={itemForm.product_id} onChange={e => setItemForm({ product_id: e.target.value, color: '', qty: 1 })}>
                  <option value="">— Модель —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select className="agent-input" value={itemForm.color} onChange={e => setItemForm({ ...itemForm, color: e.target.value })} disabled={!itemForm.product_id || getStockColors(itemForm.product_id).length === 0}>
                  <option value="">— Цвет —</option>
                  {getStockColors(itemForm.product_id).map(c => <option key={c} value={c}>{c} (на складе: {stockQty(itemForm.product_id, c)})</option>)}
                </select>
                <input className="agent-input" type="number" min="1" placeholder="Кол-во" value={itemForm.qty} onChange={e => setItemForm({ ...itemForm, qty: e.target.value })} />
                <button className="agent-btn" type="button" onClick={addItem} title="Добавить позицию">+ Добавить</button>
              </div>
              {clientForm.items.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {clientForm.items.map((it, idx) => (
                    <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f4f4f6', borderRadius: 8, padding: '4px 10px', fontSize: 13, color: '#333' }}>
                      {itemLabel(it)}
                      <button type="button" onClick={() => removeItem(idx)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999', fontSize: 13, padding: 0 }} title="Убрать">✕</button>
                    </span>
                  ))}
                </div>
              )}
              <button className="agent-btn agent-btn-primary agent-crm-submit" type="submit">Добавить клиента</button>
            </form>

            <div className="v2-card" style={{ overflow: 'hidden', padding: 0, marginTop: 16 }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table" style={{ margin: 0 }}>
                  <thead><tr>
                    <th>Клиент</th><th>Телефон</th><th>Город</th><th>Источник</th><th>Позиции</th><th>Потенциал</th><th>Статус</th><th>Заметка</th><th>Добавлен</th><th></th>
                  </tr></thead>
                  <tbody>
                    {clients.map(c => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.phone}</td>
                        <td>{c.city || '—'}</td>
                        <td>{c.source === 'site' ? 'Сайт' : (c.source === 'manual' || !c.source ? 'Свой' : c.source)}</td>
                        <td style={{ whiteSpace: 'normal', wordBreak: 'break-word', minWidth: 150 }}>
                          {(c.items || []).map(it => itemLabel(it)).join(', ') || '—'}
                        </td>
                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {c.status === 'lost' ? '—' : (c.status === 'prepaid' ? '→ заказ' : ((c.items || []).length ? `+${fmt(clientPot(c.items))} ₽` : '—'))}
                        </td>
                        <td>
                          {['new', 'talk', 'prepaid', 'lost'].includes(c.status) ? (
                            <select className="agent-input agent-input-sm" value={c.status} onChange={e => onStatusChange(c, e.target.value)}>
                              {Object.entries(STATUS_LABELS).filter(([k]) => ['new', 'talk', 'prepaid', 'lost'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          ) : (
                            <span style={{ fontSize: 13, color: '#333' }}>{STATUS_LABELS[c.status] || c.status}</span>
                          )}
                          {c.status === 'prepaid' && c.prepaid_amount > 0 && (
                            <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4, whiteSpace: 'nowrap' }}>Предоплата: {fmt(c.prepaid_amount)} ₽</div>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{c.note || '—'}</td>
                        <td>{fmtDate(c.created_at)}</td>
                        <td>
                          <button className="agent-btn agent-btn-danger" onClick={() => deleteClient(c.id)}>Удалить</button>
                        </td>
                      </tr>
                    ))}
                    {clients.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', color: '#666', padding: 40 }}>Клиентов пока нет</td></tr>}
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
                    const c = clients.find(c => tk.client_id && c.id === Number(tk.client_id))
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
        {/* МОДАЛКА ПРЕДОПЛАТЫ */}
        {prepaidModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setPrepaidModal(null)}>
            <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: 340, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 10px 40px rgba(0,0,0,.2)' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Внесена предоплата</div>
              <div style={{ fontSize: 13, color: '#555' }}>Клиент: <strong>{prepaidModal.client.name}</strong>. Введите сумму, которую внёс клиент — заказ сразу попадёт владельцу.</div>
              <input className="agent-input" type="number" min="1" placeholder="Сумма предоплаты (₽)" value={prepaidModal.amount} onChange={e => setPrepaidModal({ ...prepaidModal, amount: e.target.value })} autoFocus />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="agent-btn" onClick={() => setPrepaidModal(null)}>Отмена</button>
                <button className="agent-btn agent-btn-primary" onClick={confirmPrepaid}>Подтвердить</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
