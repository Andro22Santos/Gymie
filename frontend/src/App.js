import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import MealsPage from './pages/MealsPage';
import WaterPage from './pages/WaterPage';
import WorkoutPage from './pages/WorkoutPage';
import ProgressPage from './pages/ProgressPage';
import SettingsPage from './pages/SettingsPage';
import AchievementsPage from './pages/AchievementsPage';
import BottomNav from './components/BottomNav';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;
  if (!user.profile?.onboarding_completed) return <Navigate to="/onboarding" />;
  return children;
}

function AuthRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user && user.profile?.onboarding_completed) return <Navigate to="/" />;
  if (user && !user.profile?.onboarding_completed) return <Navigate to="/onboarding" />;
  return children;
}

function OnboardingRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;
  if (user.profile?.onboarding_completed) return <Navigate to="/" />;
  return children;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-tactical border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-heading text-xl uppercase tracking-wider text-tactical">Carregando...</p>
      </div>
    </div>
  );
}

function AppLayout({ children }) {
  return (
    <div className="max-w-md mx-auto min-h-screen bg-bg relative pb-20">
      {children}
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
          <Route path="/signup" element={<AuthRoute><SignupPage /></AuthRoute>} />
          <Route path="/forgot-password" element={<AuthRoute><ForgotPasswordPage /></AuthRoute>} />
          <Route path="/onboarding" element={<OnboardingRoute><OnboardingPage /></OnboardingRoute>} />
          <Route path="/" element={<PrivateRoute><AppLayout><HomePage /></AppLayout></PrivateRoute>} />
          <Route path="/chat" element={<PrivateRoute><AppLayout><ChatPage /></AppLayout></PrivateRoute>} />
          <Route path="/meals" element={<PrivateRoute><AppLayout><MealsPage /></AppLayout></PrivateRoute>} />
          <Route path="/water" element={<PrivateRoute><AppLayout><WaterPage /></AppLayout></PrivateRoute>} />
          <Route path="/workout" element={<PrivateRoute><AppLayout><WorkoutPage /></AppLayout></PrivateRoute>} />
          <Route path="/progress" element={<PrivateRoute><AppLayout><ProgressPage /></AppLayout></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><AppLayout><SettingsPage /></AppLayout></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
