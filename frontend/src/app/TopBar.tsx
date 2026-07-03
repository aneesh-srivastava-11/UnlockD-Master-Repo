import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui/button';

export const TopBar: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center justify-center rounded border text-text-primary hover:bg-surface-elevated text-xs font-semibold px-3 h-10 transition-colors ${
      isActive ? 'border-accent bg-surface-elevated' : 'border-border bg-transparent'
    }`;

  return (
    <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center p-4 bg-surface border-b border-border gap-3.5 w-full box-border">
      {/* Brand logo & name */}
      <Link to="/" className="flex items-center gap-2.5 shrink-0">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-accent text-white font-mono font-bold text-sm shrink-0">
          F
        </span>
        <span className="font-semibold text-text-primary text-base">Financista</span>
      </Link>
      
      {/* User details and navigation actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between xl:justify-end gap-3 w-full min-w-0">
        <span className="font-mono text-xs text-text-secondary truncate max-w-full md:max-w-[180px]" title={user.email}>
          {user.email}
        </span>
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <NavLink to="/" className={linkClass} end>Overview</NavLink>
          <Link to="/#accounts" className="inline-flex items-center justify-center rounded border border-border bg-transparent text-text-primary hover:bg-surface-elevated text-xs font-semibold px-3 h-10 transition-colors">Accounts</Link>
          <Link to="/#transfers" className="inline-flex items-center justify-center rounded border border-border bg-transparent text-text-primary hover:bg-surface-elevated text-xs font-semibold px-3 h-10 transition-colors">Transfers</Link>
          <Link to="/#budgets" className="inline-flex items-center justify-center rounded border border-border bg-transparent text-text-primary hover:bg-surface-elevated text-xs font-semibold px-3 h-10 transition-colors">Budgets</Link>
          <NavLink to="/groups" className={linkClass}>Groups</NavLink>
          <NavLink to="/history" className={linkClass}>History</NavLink>
          <NavLink to="/imports" className={linkClass}>Import</NavLink>
          <NavLink to="/analytics" className={linkClass}>Analytics</NavLink>
          <NavLink to="/settings" className={linkClass}>Settings</NavLink>
          <Button 
            variant="outline" 
            onClick={logout} 
            className="h-10 px-3 text-xs border-border bg-transparent text-text-primary hover:bg-surface-elevated"
          >
            Log Out
          </Button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
