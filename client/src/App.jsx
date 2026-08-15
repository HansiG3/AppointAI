import { useState } from 'react'

function App() {
  return (
    <div className="container" style={{ paddingTop: 'var(--space-3xl)', textAlign: 'center' }}>
      <h1 style={{ marginBottom: 'var(--space-lg)', color: 'var(--accent-primary)' }}>
        AppointAI
      </h1>
      <p style={{ fontSize: 'var(--text-lg)', color: 'var(--text-secondary)' }}>
        Conversational healthcare appointment booking
      </p>
      <p style={{ marginTop: 'var(--space-xl)', color: 'var(--text-tertiary)' }}>
        Frontend is running. Backend health check coming next...
      </p>
    </div>
  )
}

export default App
