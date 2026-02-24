import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      api.get('/api/me')
        .then((res) => {
          setUser(res.data);
          setLoading(false);
        })
        .catch(() => {
          localStorage.clear();
          setUser(null);
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
    const me = await api.get('/api/me');
    setUser(me.data);
    return res.data;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/api/auth/register', { name, email, password });
    localStorage.setItem('access_token', res.data.access_token);
    localStorage.setItem('refresh_token', res.data.refresh_token);
    const me = await api.get('/api/me');
    setUser(me.data);
    return res.data;
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  const refreshUser = async () => {
    const me = await api.get('/api/me');
    setUser(me.data);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
