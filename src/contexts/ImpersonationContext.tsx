import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface ImpersonatedSchool {
  id: string;
  name: string;
  logo?: string;
  subdomain?: string;
}

interface ImpersonationContextType {
  impersonatedSchool: ImpersonatedSchool | null;
  isImpersonating: boolean;
  startImpersonation: (school: ImpersonatedSchool) => void;
  stopImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonatedSchool, setImpersonatedSchool] = useState<ImpersonatedSchool | null>(null);

  const startImpersonation = useCallback((school: ImpersonatedSchool) => {
    setImpersonatedSchool(school);
  }, []);

  const stopImpersonation = useCallback(() => {
    setImpersonatedSchool(null);
  }, []);

  return (
    <ImpersonationContext.Provider value={{
      impersonatedSchool,
      isImpersonating: !!impersonatedSchool,
      startImpersonation,
      stopImpersonation,
    }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider');
  }
  return context;
}
