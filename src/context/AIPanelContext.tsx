"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from "react";

export interface DocState {
  owner: string;
  repo: string;
  filePath: string;
  content: string;
  sha: string;
}

interface AIPanelContextValue {
  open: boolean;
  toggle: () => void;
  docState: DocState | null;
  setDocState: (s: DocState | null) => void;
  onEditAppliedRef: React.MutableRefObject<
    ((content: string, sha: string) => void) | null
  >;
}

const AIPanelContext = createContext<AIPanelContextValue | null>(null);

export function AIPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [docState, setDocState] = useState<DocState | null>(null);
  const onEditAppliedRef = useRef<((content: string, sha: string) => void) | null>(null);

  const toggle = useCallback(() => setOpen((o) => !o), []);

  return (
    <AIPanelContext.Provider value={{ open, toggle, docState, setDocState, onEditAppliedRef }}>
      {children}
    </AIPanelContext.Provider>
  );
}

export function useAIPanel() {
  const ctx = useContext(AIPanelContext);
  if (!ctx) throw new Error("useAIPanel must be used within AIPanelProvider");
  return ctx;
}
