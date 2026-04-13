import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

const T = {
  cream:  "#EDE8E0",
  forest: "#1C2B2B",
  mauve:  "#9E7B7B",
  border: "#D5CEC6",
  white:  "#FAFAF8",
};

export default function Login() {
  const [pw,  setPw]  = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setErr("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) {
      router.push("/");
    } else {
      setErr("Incorrect password");
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Nordic Beauty Intelligence — Matas Group</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${T.cream}; font-family: 'Nunito Sans', sans-serif; }
      `}</style>
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", background: T.cream,
      }}>
        <div style={{ marginBottom: 48, textAlign: "center" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.45em", color: T.mauve, textTransform: "uppercase", marginBottom: 10 }}>MATAS GROUP</div>
          <div style={{ fontSize: 22, letterSpacing: "0.14em", textTransform: "uppercase", color: T.forest, fontWeight: 300 }}>Nordic Beauty Intelligence</div>
        </div>

        <form onSubmit={submit} style={{
          background: T.white, border: `1px solid ${T.border}`,
          padding: "40px 48px", width: 360,
        }}>
          <div style={{ fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", color: T.mauve, marginBottom: 20 }}>Access required</div>

          <input
            type="password"
            placeholder="Enter password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            style={{
              width: "100%", padding: "12px 14px",
              background: T.cream, border: `1px solid ${T.border}`,
              fontSize: 14, color: T.forest, fontFamily: "inherit",
              outline: "none", marginBottom: 8,
              letterSpacing: "0.1em",
            }}
          />

          {err && <div style={{ fontSize: 11, color: "#7A3A3A", marginBottom: 12 }}>{err}</div>}

          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "12px",
            background: T.forest, color: T.cream, border: "none",
            fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase",
            cursor: loading ? "wait" : "pointer", fontFamily: "inherit",
            marginTop: 8,
          }}>
            {loading ? "Verifying..." : "Enter"}
          </button>
        </form>
      </div>
    </>
  );
}
