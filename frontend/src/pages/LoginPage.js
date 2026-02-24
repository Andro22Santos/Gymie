import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Dumbbell, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import api from '../api';

export default function LoginPage() {
  const { login, setUser, setToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingGoogle, setProcessingGoogle] = useState(false);

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  // Check for session_id from Google OAuth callback
  useEffect(() => {
    const hash = location.hash;
    if (hash && hash.includes('session_id=')) {
      const sessionId = new URLSearchParams(hash.substring(1)).get('session_id');
      if (sessionId) {
        processGoogleSession(sessionId);
      }
    }
  }, [location]);

  const processGoogleSession = async (sessionId) => {
    setProcessingGoogle(true);
    setError('');
    try {
      const res = await api.post('/api/auth/google/session', { session_id: sessionId });
      // Store tokens
      localStorage.setItem('access_token', res.data.access_token);
      localStorage.setItem('refresh_token', res.data.refresh_token);
      setToken(res.data.access_token);
      setUser({
        user_id: res.data.user_id,
        name: res.data.name,
        email: res.data.email,
        picture: res.data.picture,
      });
      // Clear hash from URL
      window.history.replaceState(null, '', window.location.pathname);
      // Navigate based on onboarding status
      if (res.data.onboarding_completed) {
        navigate('/');
      } else {
        navigate('/onboarding');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao processar login com Google');
      window.history.replaceState(null, '', window.location.pathname);
    } finally {
      setProcessingGoogle(false);
    }
  };

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/login';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Preencha todos os campos'); return; }
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.onboarding_completed) navigate('/');
      else navigate('/onboarding');
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-12">
          <div className="w-16 h-16 rounded-2xl bg-gymie/10 flex items-center justify-center mb-4">
            <Dumbbell className="text-gymie" size={32} strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-bold text-txt-primary tracking-tight">Gymie</h1>
          <p className="text-sm text-txt-muted mt-1">Seu companheiro de rotina</p>
        </div>

        {processingGoogle ? (
          <div className="text-center py-8">
            <Loader2 size={32} className="animate-spin text-gymie mx-auto mb-4" />
            <p className="text-txt-secondary">Processando login com Google...</p>
          </div>
        ) : (
          <>
            {/* Google Login Button */}
            <button
              data-testid="google-login-btn"
              onClick={handleGoogleLogin}
              className="w-full gymie-btn-secondary flex items-center justify-center gap-3 mb-6"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar com Google
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-border-default" />
              <span className="text-xs text-txt-muted">ou</span>
              <div className="flex-1 h-px bg-border-default" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div data-testid="login-error" className="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-gymie-sm text-danger text-sm p-3">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-txt-muted uppercase tracking-wider mb-2 block">Email</label>
                <input
                  data-testid="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full gymie-input"
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-txt-muted uppercase tracking-wider mb-2 block">Senha</label>
                <div className="relative">
                  <input
                    data-testid="login-password"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full gymie-input pr-12"
                    placeholder="Sua senha"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPw(!showPw)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-secondary transition-colors"
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                data-testid="login-submit"
                type="submit"
                disabled={loading}
                className="w-full gymie-btn-primary mt-2 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </button>
            </form>

            <div className="mt-8 text-center space-y-3">
              <Link 
                data-testid="forgot-password-link" 
                to="/forgot-password" 
                className="text-sm text-txt-muted hover:text-txt-secondary transition-colors block"
              >
                Esqueci minha senha
              </Link>
              <Link 
                data-testid="signup-link" 
                to="/signup" 
                className="text-sm text-gymie hover:text-gymie-dim transition-colors block font-semibold"
              >
                Criar conta
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
