import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const logoSrc = `${import.meta.env.BASE_URL}logo.png?v=20260426-login`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login({ email, password });
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Dang nhap that bai');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-background-orb login-background-orb-one" />
      <div className="login-background-orb login-background-orb-two" />

      <div className="login-card">
        <div className="login-header">
          <div className="login-brand-badge">
            <img src={logoSrc} alt="HAVIAS logo" />
          </div>
          <div className="login-kicker">HAVIAS Warehouse Platform</div>
          <h1>HAVIAS Inventory & Warehouse Management System (IWMS)</h1>
          <p>Dang nhap de tiep tuc</p>
        </div>

        <div className="login-body">
          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mat khau</label>
              <input
                type="password"
                className="form-control"
                placeholder="Nhap mat khau"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="spinner" style={{ borderTopColor: '#fff' }} />
                  Dang dang nhap...
                </>
              ) : (
                'Dang nhap'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
