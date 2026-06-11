import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/Home'
import RestaurantList from './pages/Dashboard'
import { RestaurantDetailRoute } from './pages/RestaurantDetail'
import ChatPage from './pages/Chatbot'
import LoginPage from './pages/Login'

function PrivateRoute({ children }) {
  const token = localStorage.getItem('safeplate_token')
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/"                   element={<PrivateRoute><HomePage /></PrivateRoute>} />
        <Route path="/dashboard"          element={<PrivateRoute><RestaurantList /></PrivateRoute>} />
        <Route path="/restaurants/:camis" element={<PrivateRoute><RestaurantDetailRoute /></PrivateRoute>} />
        <Route path="/chat"               element={<PrivateRoute><ChatPage /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
