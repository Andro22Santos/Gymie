import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Target, MessageSquare, UtensilsCrossed, Droplet, Settings } from 'lucide-react';

const tabs = [
  { path: '/', icon: Target, label: 'Hoje' },
  { path: '/chat', icon: MessageSquare, label: 'Chat' },
  { path: '/meals', icon: UtensilsCrossed, label: 'Refeicoes' },
  { path: '/water', icon: Droplet, label: 'Agua' },
  { path: '/settings', icon: Settings, label: 'Config' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-bg/90 backdrop-blur-lg border-t border-border-default z-50"
      style={{ height: '64px' }}
    >
      <div className="flex items-center justify-around h-full px-2">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              data-testid={`nav-${tab.label.toLowerCase()}`}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 relative ${
                active ? 'text-tactical' : 'text-txt-muted hover:text-txt-secondary'
              }`}
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-tactical" />
              )}
              <Icon size={20} strokeWidth={1.5} />
              <span className="text-[10px] mt-1 font-ui tracking-wider uppercase">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
