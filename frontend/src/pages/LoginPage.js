import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Dumbbell, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      </div>
    </div>
  );
}
