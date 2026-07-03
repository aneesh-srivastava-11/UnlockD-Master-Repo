import React from 'react';
import { useAuth } from '../auth/AuthContext';

export const TopBar: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header className="top-bar">
      <div className="top-bar-brand">
        <span className="brand-logo-small">F</span>
        <span className="brand-name">Financista</span>
      </div>
      <div className="top-bar-user">
        <span className="user-email">{user.email}</span>
        <button className="btn-secondary" onClick={logout}>
          Log Out
        </button>
      </div>
    </header>
  );
};
export default TopBar;
