import { Routes, Route } from 'react-router-dom'
import Catalog from './pages/Catalog'
import Admin from './pages/Admin'
import Login from './pages/Login'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Catalog />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  )
}
