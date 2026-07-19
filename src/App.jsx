import { Routes, Route } from 'react-router-dom'
import { LangProvider } from './i18n'
import Catalog from './pages/Catalog'
import Admin from './pages/Admin'
import Login from './pages/Login'

export default function App() {
  return (
    <LangProvider>
      <Routes>
        <Route path="/" element={<Catalog />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </LangProvider>
  )
}
