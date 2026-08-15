import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function ChatPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--surface-1)',
      padding: 'var(--space-2xl)'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-2xl)'
        }}>
          <div>
            <h1 style={{ color: 'var(--accent-primary)', marginBottom: 'var(--space-xs)' }}>
              AppointAI Chat
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Welcome back, {user?.name}
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: 'var(--space-md) var(--space-xl)',
              background: 'var(--surface-3)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Logout
          </button>
        </div>

        <div style={{
          background: 'var(--surface-2)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-3xl)',
          textAlign: 'center'
        }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-lg)' }}>
            Conversational booking interface coming in Phase 6
          </p>
          <p style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-md)' }}>
            Authentication is working! You're logged in as a {user?.role} user.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ChatPage;
