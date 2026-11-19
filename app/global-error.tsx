"use client";
// Last-resort boundary for errors thrown above every other error boundary (e.g. in the root or app layout).
// It replaces the root layout, so it must render its own <html> and inline styles.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "ui-sans-serif, system-ui, sans-serif", background: "#0b0d14", color: "#e5e7eb" }}>
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 36 }}>⚠️</div>
          <h1 style={{ fontSize: 20, margin: "12px 0 6px" }}>Personal OS hit an unexpected error</h1>
          <p style={{ fontSize: 14, color: "#94a3b8", margin: 0 }}>Your data is safe. Try again, or sign in again if the problem persists.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
            <button onClick={reset} style={{ padding: "8px 16px", borderRadius: 8, border: 0, background: "#818cf8", color: "#0b0d14", fontWeight: 600, cursor: "pointer" }}>Try again</button>
            <a href="/login" style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #2a3043", color: "#e5e7eb", textDecoration: "none" }}>Sign in</a>
          </div>
          {error.digest && <p style={{ marginTop: 24, fontSize: 11, color: "#64748b", fontFamily: "ui-monospace, monospace" }}>Reference: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
