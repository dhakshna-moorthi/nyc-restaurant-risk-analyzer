import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/Home'
import RestaurantList from './pages/Dashboard'
import { RestaurantDetailRoute } from './pages/RestaurantDetail'
import ChatPage from './pages/Chatbot'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                   element={<HomePage />} />
        <Route path="/dashboard"          element={<RestaurantList />} />
        <Route path="/restaurants/:camis" element={<RestaurantDetailRoute />} />
        <Route path="/chat"               element={<ChatPage />} />
      </Routes>
    </BrowserRouter>
  )
}
