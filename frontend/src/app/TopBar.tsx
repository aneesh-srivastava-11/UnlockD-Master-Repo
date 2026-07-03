import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui/button';

export const TopBar: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-surface border-b border-border gap-3.5 w-full box-border">
      {/* Brand logo & name */}
      <div className="flex items-center gap-2.5">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-accent text-white font-mono font-bold text-sm shrink-0">
          F
        </span>
        <span className="font-semibold text-text-primary text-base">Financista</span>
      </div>
      
      {/* User details and navigation actions */}
      <div className="flex flex-row items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
        <span className="font-mono text-xs text-text-secondary truncate max-w-[140px] sm:max-w-none">
          {user.email}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <Link 
            to="/" 
            className="inline-flex items-center justify-center rounded border border-border bg-transparent text-text-primary hover:bg-surface-elevated text-xs font-semibold px-3 h-11 sm:h-9 transition-colors"
          >
            Dashboard
          </Link>
          <Link 
            to="/groups" 
            className="inline-flex items-center justify-center rounded border border-border bg-transparent text-text-primary hover:bg-surface-elevated text-xs font-semibold px-3 h-11 sm:h-9 transition-colors"
          >
            Groups
          </Link>
          <Link 
            to="/history" 
            className="inline-flex items-center justify-center rounded border border-border bg-transparent text-text-primary hover:bg-surface-elevated text-xs font-semibold px-3 h-11 sm:h-9 transition-colors"
          >
            History
          </Link>
          <Link 
            to="/settings" 
            className="inline-flex items-center justify-center rounded border border-border bg-transparent text-text-primary hover:bg-surface-elevated text-xs font-semibold px-3 h-11 sm:h-9 transition-colors"
          >
            Settings
          </Link>
          <Button 
            variant="outline" 
            onClick={logout} 
            className="h-11 sm:h-9 px-3 text-xs border-border bg-transparent text-text-primary hover:bg-surface-elevated"
          >
            Log Out
          </Button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
