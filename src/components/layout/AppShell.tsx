"use client";

import Sidebar from "./Sidebar";
import Header from "./Header";
import ChatPanel from "@/components/ai/ChatPanel";
import { AIPanelProvider } from "@/context/AIPanelContext";

interface AppShellProps {
  children: React.ReactNode;
  owner: string;
  repo: string;
}

export default function AppShell({ children, owner, repo }: AppShellProps) {
  return (
    <AIPanelProvider>
      <div className="app-shell">
        <aside className="app-sidebar">
          <Sidebar owner={owner} repo={repo} />
        </aside>
        <header className="app-header">
          <Header owner={owner} repo={repo} />
        </header>
        <main className="app-main">{children}</main>
      </div>
      <ChatPanel owner={owner} repo={repo} />
    </AIPanelProvider>
  );
}
