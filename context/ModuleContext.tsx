import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PageProp {
  title: string;
  id: string;
}

interface ModuleContextType {
  selectedModule: string | null;
  setSelectedModule: (moduleId: string) => void;
  pageProp: PageProp | null;
  setPageProp: (pageProp: PageProp | null) => void;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export function ModuleProvider({ children }: { children: ReactNode }) {
  const [selectedModule, setSelectedModule] = useState<string | null>('spaces');
  const [pageProp, setPageProp] = useState<PageProp | null>(null);

  return (
    <ModuleContext.Provider value={{ selectedModule, setSelectedModule, pageProp, setPageProp }}>
      {children}
    </ModuleContext.Provider>
  );
}

export function useModule() {
  const context = useContext(ModuleContext);
  if (context === undefined) {
    throw new Error('useModule must be used within a ModuleProvider');
  }
  return context;
}