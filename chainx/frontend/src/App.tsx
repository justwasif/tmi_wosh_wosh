import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import DashboardPage from './dashboard/DashboardPage'
import ProductTimelinePage from './product/ProductTimelinePage'
import ScanPage from './scan/ScanPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/product/:id" element={<ProductTimelinePage />} />
        <Route path="/scan" element={<ScanPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App