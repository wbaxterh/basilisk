import type { ReactNode } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import ChatPanel from "../../components/chat/ChatPanel";
import { WalletProvider } from "../../lib/wallet-context";

/** App pages get the sidebar + header chrome + wallet context + Ask Basilisk. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <Sidebar />
      <div style={{
        marginLeft: "var(--sidebar-width)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}>
        <Header />
        <main style={{ flex: 1, padding: 24 }}>
          {children}
        </main>
      </div>
      <ChatPanel />
    </WalletProvider>
  );
}
