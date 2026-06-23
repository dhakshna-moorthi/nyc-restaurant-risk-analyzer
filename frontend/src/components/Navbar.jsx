import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import '../styles/shared.css'


function NavLink({ to, children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  const isActive = location.pathname === to

  return (
    <span
      onClick={() => navigate(to)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        color: '#ffffff',
        fontSize: '14px',
        padding: '8px 16px',
        cursor: 'pointer',
        fontWeight: isActive ? '700' : '400',
        textDecoration: hovered ? 'underline' : 'none',
        textUnderlineOffset: '3px',
        userSelect: 'none',
      }}
    >
      {children}
    </span>
  )
}

export function Header() {
  const navigate = useNavigate()
  const [dark, setDark] = useState(() => localStorage.getItem('safeplate_theme') === 'dark')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('safeplate_theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <header className="site-header">
      <div className="site-header-logo" onClick={() => navigate('/')}>
        <span className="site-header-title">SafePlate</span>
        <span className="site-header-subtitle">NYC Restaurant Health Risk Inspection Portal</span>
      </div>

      {/* Desktop navigation */}
      <nav className="nav-desktop-links">
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/chat">Chatbot</NavLink>
        <div className="nav-theme-toggle">
          <button className={`nav-theme-btn${!dark ? ' active' : ''}`} onClick={() => setDark(false)}>Light</button>
          <button className={`nav-theme-btn${dark ? ' active' : ''}`} onClick={() => setDark(true)}>Dark</button>
        </div>
      </nav>

      {/* Hamburger button — mobile only */}
      <button className="nav-hamburger" onClick={() => setMenuOpen((o) => !o)}>☰</button>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="nav-mobile-dropdown">
          <button className="nav-mobile-item" onClick={() => { navigate('/dashboard'); setMenuOpen(false) }}>Dashboard</button>
          <button className="nav-mobile-item" onClick={() => { navigate('/chat'); setMenuOpen(false) }}>Chatbot</button>
          <hr className="nav-mobile-divider" />
          <div className="nav-mobile-theme">
            <span>Theme:</span>
            <button className={`nav-mobile-theme-btn${!dark ? ' active' : ''}`} onClick={() => setDark(false)}>Light</button>
            <button className={`nav-mobile-theme-btn${dark ? ' active' : ''}`} onClick={() => setDark(true)}>Dark</button>
          </div>
        </div>
      )}
    </header>
  )
}
