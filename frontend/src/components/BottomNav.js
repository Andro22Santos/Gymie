import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Target, MessageSquare, UtensilsCrossed, Dumbbell, TrendingUp } from 'lucide-react';

const tabs = [
  { path: '/', icon: Target, label: 'Hoje' },
  { path: '/chat', icon: MessageSquare, label: 'Gymie' },
  { path: '/meals', icon: UtensilsCrossed, label: 'Refeições' },
  { path: '/workout', icon: Dumbbell, label: 'Treino' },
  { path: '/progress', icon: TrendingUp, label: 'Progresso' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md 
                 bg-bg/95 backdrop-blur-xl border-t border-border-subtle pb-safe"
      style={{ zIndex: 90 }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              data-testid={`nav-${tab.label.toLowerCase().replace('ç', 'c').replace('õ', 'o')}`}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full 
                         transition-all duration-200 relative group touch-feedback`}
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-gymie rounded-full" />
              )}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                active ? 'bg-gymie/10' : 'group-hover:bg-surface-hl'
              }`}>
                <Icon 
                  size={20} 
                  strokeWidth={active ? 2 : 1.5}
                  className={active ? 'text-gymie' : 'text-txt-muted group-hover:text-txt-secondary'}
                />
              </div>
              <span className={`text-[10px] mt-0.5 transition-colors duration-200 ${
                active ? 'text-gymie font-medium' : 'text-txt-muted'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
