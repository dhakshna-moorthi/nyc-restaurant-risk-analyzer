import { useState } from 'react'
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
  return (
    <header
      style={{
        backgroundColor: '#1a2744',
        padding: '16px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div
        onClick={() => navigate('/')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          paddingLeft: '24px',
          cursor: 'pointer',
        }}
      >
        <span style={{ color: '#ffffff', fontWeight: '700', fontSize: '22px', lineHeight: 1.2 }}>
          SafePlate
        </span>
        <span style={{ color: '#9ca3af', fontSize: '13px' }}>
          NYC Restaurant Health Risk Inspection Portal
        </span>
      </div>
      <nav style={{ display: 'flex', alignItems: 'center', paddingRight: '24px', gap: '4px' }}>
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/chat">Chatbot</NavLink>
        <button
          onClick={() => {
            localStorage.removeItem('safeplate_token')
            navigate('/login')
          }}
          style={{
            marginLeft: '12px',
            padding: '7px 16px',
            fontSize: '13px',
            fontFamily: "'Inter', sans-serif",
            backgroundColor: 'transparent',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.35)',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </nav>
    </header>
  )
}
