import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { Header } from '../components/Navbar'
import { CriticalityBadge, TrendCell, useTypewriter, Cursor } from '../components/Shared'
import '../styles/shared.css'
import '../styles/chatbot.css'

// ── Constants ──────────────────────────────────────────────────────────────
const CHAT_STARTERS = [
  "Which restaurants in Manhattan have the highest risk scores?",
  "Plan my inspection schedule for this week — 3 restaurants per day",
  "Which cuisine types have the most critical violations?",
]

// ── Sub-components ─────────────────────────────────────────────────────────
function AssistantBubble({ content, timestamp, isLatest }) {
  const { displayed, done } = useTypewriter(content, 8, isLatest)
  const text = isLatest ? displayed : content
  const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '20px', lineHeight: 1 }}>🍽️</span>
        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--heading-color)' }}>SafeBot</span>
      </div>
      <div className="bubble-assistant">
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
      <div className="bubble-timestamp">{fmtTime(timestamp)}</div>
    </div>
  )
}

function StarterChip({ text, onSend }) {
  return (
    <button className="starter-chip" onClick={() => onSend(text)}>
      {text}
    </button>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const [messages, setMessages]               = useState([])
  const [conversationHistory, setConversationHistory] = useState([])
  const [input, setInput]                     = useState('')
  const [loading, setLoading]                 = useState(false)
  const [queryData, setQueryData]             = useState(null)
  const [queryType, setQueryType]             = useState(null)
  const [suggestedQuestions, setSuggestedQuestions] = useState([])
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const msg = text.trim()
    if (!msg || loading) return
    setInput('')
    const now = new Date()
    setMessages((prev) => [...prev, { role: 'user', content: msg, timestamp: now }])
    setLoading(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('safeplate_token')}`,
        },
        body: JSON.stringify({ question: msg, conversation_history: conversationHistory }),
      })
      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer, timestamp: new Date() }])
      setConversationHistory((prev) => [
        ...prev,
        { role: 'user', content: msg },
        { role: 'assistant', content: data.answer },
      ])
      setQueryData(data.data ?? null)
      setQueryType(data.type ?? null)
      setSuggestedQuestions(data.suggested_questions ?? [])
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: "Sorry, I couldn't process that request. Please try again.",
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const lastAssistantIdx = messages.reduce((last, msg, i) => msg.role === 'assistant' ? i : last, -1)

  return (
    <div className="chat-page">
      <Header />
      <div className="chat-layout">

        {/* Left: Chat — 70% */}
        <div className="chat-panel">

          <div className="chat-panel-header">
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--heading-color)' }}>SafePlate Assistant</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Ask anything about NYC restaurant inspections
            </div>
          </div>

          <div className="chat-messages">
            {messages.length === 0 && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '4px' }}>Try asking:</div>
                {CHAT_STARTERS.map((q) => (
                  <StarterChip key={q} text={q} onSend={sendMessage} />
                ))}
              </div>
            )}
            {messages.map((msg, i) =>
              msg.role === 'assistant' ? (
                <AssistantBubble key={i} content={msg.content} timestamp={msg.timestamp} isLatest={i === lastAssistantIdx} />
              ) : (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div className="bubble-user">{msg.content}</div>
                  <div className="bubble-timestamp">{fmtTime(msg.timestamp)}</div>
                </div>
              )
            )}
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px', lineHeight: 1 }}>🍽️</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--heading-color)' }}>SafeBot</span>
                </div>
                <div
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '20px 20px 20px 4px',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {[0, 1, 2].map((n) => (
                    <span
                      key={n}
                      className="typing-dot"
                      style={{ animation: `chat-bounce 1.4s ease-in-out ${n * 0.16}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-bar">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
              disabled={loading}
              placeholder="Ask about NYC restaurant inspections..."
              className="chat-input"
              style={{ backgroundColor: loading ? 'var(--table-alt-row)' : 'var(--bg-card)' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="btn-send"
              style={{ backgroundColor: loading || !input.trim() ? '#9ca3af' : '#1a2744', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer' }}
            >
              →
            </button>
          </div>
        </div>

        {/* Right: Data panel — 30% */}
        <div className="data-panel">
          <div className="data-panel-header">
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--heading-color)' }}>Query Results</div>
          </div>
          <div className="data-panel-body">
            {queryType === 'unanswerable' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Try these instead:</div>
                {suggestedQuestions.map((q, i) => (
                  <StarterChip key={i} text={q} onSend={sendMessage} />
                ))}
              </div>
            ) : queryData && queryData.length > 0 ? (() => {
              const keys = Object.keys(queryData[0])
              const formatHeader = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
              const renderCell = (key, value) => {
                if (key === 'criticality') return <CriticalityBadge value={value} />
                if (key === 'trend') return <TrendCell value={value} />
                return value ?? '—'
              }
              return (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: 'var(--text-primary)' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#1a2744' }}>
                        {keys.map((k) => (
                          <th key={k} style={{ padding: '8px 10px', textAlign: 'left', color: '#ffffff', fontWeight: '600', whiteSpace: 'nowrap' }}>
                            {formatHeader(k)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryData.map((row, i) => (
                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'var(--bg-card)' : 'var(--table-alt-row)' }}>
                          {keys.map((k) => (
                            <td key={k} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                              {renderCell(k, row[k])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })() : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '200px', color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '40px 16px' }}>
                Ask a question to see data results here
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
