import { Routes, Route } from 'react-router-dom'
import { LangProvider } from './i18n'
import Catalog from './pages/Catalog'
import Admin from './pages/Admin'
import Login from './pages/Login'
import AgentPage from './pages/AgentPage'

export default function App() {
  return (
    <LangProvider>
      <Routes>
        <Route path="/" element={<Catalog />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/agent" element={<AgentPage />} />
      </Routes>
    </LangProvider>
  )
}
