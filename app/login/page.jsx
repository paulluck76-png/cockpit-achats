"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit() {
    setErr("");
    setLoading(true);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (r.ok) {
        router.replace("/");
      } else {
        const d = await r.json().catch(() => ({}));
        setErr(d.error || "Connexion refusée.");
      }
    } catch {
      setErr("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="t">Cockpit Achats</div>
        <div className="s">Espace privé — mot de passe requis.</div>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && submit()}
          placeholder="Mot de passe"
          autoFocus
        />
        {err && <div className="err" style={{ marginTop: 0, marginBottom: 12 }}>{err}</div>}
        <button className="btn" onClick={submit} disabled={loading}>
          {loading ? <span className="spin" /> : "Entrer"}
        </button>
      </div>
    </div>
  );
}
