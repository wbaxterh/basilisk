export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "80px 24px",
        background: "linear-gradient(160deg, #0033AD 0%, #0A1E5E 60%, #061233 100%)",
        color: "#fff",
      }}
    >
      <div style={{ fontSize: 64, marginBottom: 8 }}>🐍</div>
      <h1 style={{ fontSize: 72, fontWeight: 800, letterSpacing: -3, margin: 0 }}>
        <span style={{ color: "#fff" }}>Basi</span>
        <span style={{ color: "#2DB67C" }}>lisk</span>
      </h1>
      <p style={{ fontSize: 20, color: "#C7D6FF", maxWidth: 520 }}>
        Cardano on-chain analytics, portfolio &amp; trading. Web app shell —
        EPIC-9 (US-9.1). Wire up the dashboard from here.
      </p>
      <code
        style={{
          marginTop: 24,
          background: "rgba(255,255,255,0.1)",
          padding: "8px 14px",
          borderRadius: 8,
          fontSize: 13,
        }}
      >
        apps/web · Next.js
      </code>
    </main>
  );
}
