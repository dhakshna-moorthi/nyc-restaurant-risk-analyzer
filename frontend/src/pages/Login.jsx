import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(false)
    setLoading(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!response.ok) {
        setError(true)
        return
      }
      const data = await response.json()
      localStorage.setItem('safeplate_token', data.access_token)
      navigate('/')
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          padding: '48px 40px',
          width: '100%',
          maxWidth: '400px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ color: '#1a2744', fontWeight: '700', fontSize: '28px', lineHeight: 1.2, marginBottom: '8px' }}>
            SafePlate
          </div>
          <div style={{ color: '#6b7280', fontSize: '14px' }}>
            NYC Restaurant Health Risk Inspection Portal
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: '14px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              outline: 'none',
              fontFamily: "'Inter', sans-serif",
              boxSizing: 'border-box',
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: '14px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              outline: 'none',
              fontFamily: "'Inter', sans-serif",
              boxSizing: 'border-box',
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px',
              fontSize: '15px',
              fontWeight: '600',
              fontFamily: "'Inter', sans-serif",
              backgroundColor: loading ? '#4a6090' : '#1a2744',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '4px',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          {error && (
            <div style={{ color: '#c0392b', fontSize: '13px', textAlign: 'center' }}>
              Invalid credentials
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
