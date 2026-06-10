import type { ReactNode } from "react";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";

/** App pages get the sidebar + header chrome. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
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
    </>
  );
}
