import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('access_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // LoginPage will exchange the session_id and establish the session first.
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) {
      api.get('/api/me')
        .then((res) => {
          setUser(res.data);
          setToken(storedToken);
          setLoading(false);
        })
        .catch(() => {
          localStorage.clear();
          setUser(null);
          setToken(null);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('access_token', res.data.access_token);
    localStorage.setItem('refresh_token', res.data.refresh_token);
    setToken(res.data.access_token);
    const me = await api.get('/api/me');
    setUser(me.data);
    return res.data;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/api/auth/register', { name, email, password });
    localStorage.setItem('access_token', res.data.access_token);
    localStorage.setItem('refresh_token', res.data.refresh_token);
    setToken(res.data.access_token);
    const me = await api.get('/api/me');
    setUser(me.data);
    return res.data;
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    setToken(null);
  };

  const refreshUser = async () => {
    const me = await api.get('/api/me');
    setUser(me.data);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser, setUser, setToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
