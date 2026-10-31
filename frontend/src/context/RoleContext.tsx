import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '../types';

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isSupervisor: boolean;
  isFieldWorker: boolean;
  isCitizen: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem('wastetrace_role');
    return (saved as UserRole) || 'Supervisor';
  });

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem('wastetrace_role', newRole);
  };

  const isSupervisor = role === 'Supervisor';
  const isFieldWorker = role === 'Field Worker';
  const isCitizen = role === 'Citizen';

  return (
    <RoleContext.Provider value={{ role, setRole, isSupervisor, isFieldWorker, isCitizen }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};

