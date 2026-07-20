"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const KEY = "cockpit-achats-app-v1";

const AGENTS = [
  { id: "epicerie", nom: "Épicerie & courses", emoji: "🛒", focus: "grande distribution et drive (Leclerc, Intermarché, Carrefour, Auchan), promos hebdomadaires et lots, cashback courses via Shopmium / 10% (scan de ticket)" },
  { id: "entretien", nom: "Entretien & maison", emoji: "🧴", focus: "produits d'entretien et consommables maison, achats en lot, hypermarchés et Amazon, cashback via Joko / iGraal" },
  { id: "bebe", nom: "Bébé & famille", emoji: "🍼", focus: "couches, lait, packs famille, abonnements récurrents, promos gros volumes" },
  { id: "hightech", nom: "High-tech & électro", emoji: "💻", focus: "high-tech et électroménager, reconditionné (Back Market), prix plancher historique, Super Deal Rakuten, cashback iGraal / Poulpeo" },
  { id: "beaute", nom: "Beauté & soins", emoji: "✨", focus: "parfumerie et soins (Sephora, Nocibé, pharmacies en ligne), codes promo et cashback" },
  { id: "bricolage", nom: "Bricolage & jardin", emoji: "🔧", focus: "bricolage et jardin (Leroy Merlin, ManoMano, Castorama), déstockages et cashback" },
];

const VERDICT = { ACHETE: "buy", STOCKE: "stock", SURVEILLE: "watch", ATTENDS: "wait" };
const VLABEL = { ACHETE: "Achète", STOCKE: "Stocke", SURVEILLE: "Surveille", ATTENDS: "Attends" };

export default function Page() {
  const router = useRouter();
  const [tab, setTab] = useState("cockpit");
  const [db, setDb] = useState({ products: [], prices: [], findings: [] });
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    try {
      const r = localStorage.getItem(KEY);
      if (r) setDb(JSON.parse(r));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(db));
  }, [db, ready]);

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const today = () => new Date().toISOString().slice(0, 10);
  const eur = (n) => (n == null || isNaN(n) ? "—" : n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €");
  const eur0 = (n) => (n == null || isNaN(n) ? "0 €" : Math.round(n).toLocaleString("fr-FR") + " €");

  // ---- calculs ----
  const lastMin = (pid) => {
    const ps = db.prices.filter((p) => p.pid === pid);
    if (!ps.length) return null;
    const last = ps.slice().sort((a, b) => b.date.localeCompare(a.date))[0].date;
    return Math.min(...ps.filter((p) => p.date === last).map((p) => p.prix));
  };
  const floor = (pid) => {
    const ps = db.prices.filter((p) => p.pid === pid).map((p) => p.prix);
    return ps.length ? Math.min(...ps) : null;
  };
  function signal(prod) {
    const last = lastMin(prod.id), fl = floor(prod.id);
    const cible = Number(prod.cible) || null, stock = Number(prod.stock) || 0, seuil = Number(prod.seuil) || 0;
    const stockable = prod.type === "stockable", low = stock <= seuil;
    if (last == null) return low
      ? { v: "reappro", label: "Réappro", why: "Stock sous le seuil, aucun relevé de prix — saisis un prix." }
      : { v: "wait", label: "À compléter", why: "Aucun relevé de prix pour évaluer." };
    const goodCible = cible != null && last <= cible;
    const nearFloor = fl != null && last <= fl * 1.05;
    if (nearFloor && stockable && !low) return { v: "stock", label: "Stocke", why: "Prix au plancher historique : fenêtre pour constituer un stock." };
    if ((goodCible || nearFloor) && low) return { v: "buy", label: "Achète", why: "Prix sous la cible et stock bas : à prendre maintenant." };
    if ((goodCible || nearFloor) && !low && !stockable) return { v: "watch", label: "Surveille", why: "Bon prix mais périssable et stock suffisant." };
    if (goodCible && stockable && !low) return { v: "watch", label: "Surveille", why: `Sous la cible mais pas au plancher (${eur(fl)}).` };
    if (low) return { v: "reappro", label: "Réappro", why: `Stock bas au prix moyen — meilleur prix vu : ${eur(fl)}.` };
    return { v: "wait", label: "Attends", why: `Prix au-dessus de la cible (${eur(cible || fl)}).` };
  }
  function saving(prod) {
    const last = lastMin(prod.id), conso = Number(prod.conso) || 0;
    const ps = db.prices.filter((p) => p.pid === prod.id).map((p) => p.prix);
    if (last == null || !ps.length || conso <= 0) return 0;
    const s = signal(prod);
    if (s.v !== "buy" && s.v !== "stock") return 0;
    const avg = ps.reduce((a, b) => a + b, 0) / ps.length;
    return Math.max(0, avg - last) * conso * 2;
  }

  // ---- mutations ----
  const set = (fn) => setDb((d) => { const c = structuredClone(d); fn(c); return c; });
  const delItem = (coll, id) => { if (confirm("Supprimer ?")) set((c) => (c[coll] = c[coll].filter((x) => x.id !== id))); };

  if (!ready) return null;

  const rank = { buy: 0, stock: 1, reappro: 2, watch: 3, wait: 4 };
  const rows = db.products.map((p) => ({ p, s: signal(p), g: saving(p) })).sort((a, b) => rank[a.s.v] - rank[b.s.v] || b.g - a.g);
  const nBuy = rows.filter((r) => r.s.v === "buy" || r.s.v === "stock").length;
  const nWatch = rows.filter((r) => r.s.v === "watch").length;
  const nReappro = rows.filter((r) => r.s.v === "reappro").length;
  const totGain = rows.reduce((a, r) => a + r.g, 0);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cockpit-achats-" + today() + ".json";
    a.click();
  }
  function importData(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { const d = JSON.parse(r.result); setDb({ products: d.products || [], prices: d.prices || [], findings: d.findings || [] }); alert("Import réussi."); } catch { alert("Fichier illisible."); } };
    r.readAsText(f); e.target.value = "";
  }
  function resetAll() { if (confirm("Effacer toutes les données ?")) setDb({ products: [], prices: [], findings: [] }); }

  return (
    <>
      <header className="console">
        <div className="brand">
          <div className="t">Cockpit Achats</div>
          <div className="s">Pilotage privé des bonnes opérations</div>
        </div>
        <div className="spacer" />
        <div className="kpi">
          <div className="k"><span className="v">{nBuy}</span><span className="l">À acheter</span></div>
          <div className="k"><span className="v">{nReappro}</span><span className="l">Alertes stock</span></div>
          <div className="k"><span className="v mono">{eur0(totGain)}</span><span className="l">Éco. potentielle</span></div>
        </div>
        <button className="logout" onClick={logout}>Déconnexion</button>
      </header>

      <nav className="tabs">
        {[["cockpit", "Cockpit"], ["produits", "Produits"], ["releves", "Relevés"], ["agents", "Agents live"], ["donnees", "Données"]].map(([id, l]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{l}</button>
        ))}
      </nav>

      <main>
        {/* COCKPIT */}
        {tab === "cockpit" && (
          <section>
            <div className="hint">Le moteur croise <b>prix vs plancher</b>, <b>stock vs seuil</b> et le type de produit pour prioriser tes achats. Les agents live (onglet dédié) alimentent ce cockpit en relevés.</div>
            <div className="stat-row">
              <div className="stat accent"><div className="v">{nBuy}</div><div className="l">À acheter / stocker</div></div>
              <div className="stat"><div className="v">{nWatch}</div><div className="l">À surveiller</div></div>
              <div className="stat"><div className="v">{nReappro}</div><div className="l">Réappro</div></div>
              <div className="stat"><div className="v mono">{eur0(totGain)}</div><div className="l">Éco. potentielle</div></div>
            </div>
            <div className="card">
              <h3>Signaux d'achat — priorisés</h3>
              {rows.length === 0 ? (
                <div className="empty"><div className="big">Aucun produit suivi</div>Ajoute des produits puis des relevés, ou lance un agent.</div>
              ) : (
                <div className="signal-list">
                  {rows.map(({ p, s }) => (
                    <div key={p.id} className={`signal v-${s.v}`}>
                      <div className="verdict">{s.label}</div>
                      <div><div className="name">{p.nom}</div><div className="why">{s.why}</div></div>
                      <div className="metrics">
                        <div className="m"><div className="v">{eur(lastMin(p.id))}</div><div className="l">Dernier min.</div></div>
                        <div className="m"><div className="v">{eur(floor(p.id))}</div><div className="l">Plancher</div></div>
                        <div className="m"><div className="v">{(p.stock || 0)}/{(p.seuil || 0)}</div><div className="l">Stock/seuil</div></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* PRODUITS */}
        {tab === "produits" && (
          <section>
            <div className="toolbar">
              <div><h2>Catalogue produits</h2><div className="sub">Plancher, cible, stock, seuils et conservation.</div></div>
              <button className="btn" onClick={() => setModal({ type: "product", data: { type: "stockable" } })}>+ Ajouter</button>
            </div>
            <div className="card" style={{ padding: 0, overflow: "auto" }}>
              <table>
                <thead><tr><th>Produit</th><th>Catégorie</th><th>Type</th><th className="num">Plancher</th><th className="num">Cible</th><th className="num">Dernier min.</th><th className="num">Stock</th><th className="num">Seuil</th><th>Signal</th><th></th></tr></thead>
                <tbody>
                  {db.products.length === 0 ? (
                    <tr><td colSpan={10}><div className="empty"><div className="big">Catalogue vide</div>Ajoute tes références les plus achetées.</div></td></tr>
                  ) : db.products.map((p) => {
                    const s = signal(p);
                    return (
                      <tr key={p.id}>
                        <td><b>{p.nom}</b>{p.unite ? <span style={{ color: "var(--muted)" }}> / {p.unite}</span> : null}</td>
                        <td>{p.cat || "—"}</td>
                        <td><span className={`chip ${p.type}`}>{p.type === "stockable" ? "Stockable" : "Périssable"}</span></td>
                        <td className="num">{eur(floor(p.id))}</td>
                        <td className="num">{eur(Number(p.cible) || null)}</td>
                        <td className="num">{eur(lastMin(p.id))}</td>
                        <td className="num">{p.stock || 0}</td>
                        <td className="num">{p.seuil || 0}</td>
                        <td><span className={`badge ${s.v}`}>{s.label}</span></td>
                        <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                          <button className="icon-btn" title="Relevé" onClick={() => setModal({ type: "releve", data: { pid: p.id } })}>＋€</button>
                          <button className="icon-btn" title="Éditer" onClick={() => setModal({ type: "product", data: { ...p } })}>✎</button>
                          <button className="icon-btn" title="Supprimer" onClick={() => delItem("products", p.id)}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* RELEVES */}
        {tab === "releves" && (
          <section>
            <div className="toolbar">
              <div><h2>Relevés de prix</h2><div className="sub">Chaque relevé met à jour le plancher et le dernier prix mini.</div></div>
              <button className="btn" onClick={() => setModal({ type: "releve", data: {} })} disabled={!db.products.length}>+ Nouveau relevé</button>
            </div>
            <div className="card" style={{ padding: 0, overflow: "auto" }}>
              <table>
                <thead><tr><th>Date</th><th>Produit</th><th>Enseigne</th><th className="num">Prix</th><th className="num">vs plancher</th><th></th></tr></thead>
                <tbody>
                  {db.prices.length === 0 ? (
                    <tr><td colSpan={6}><div className="empty"><div className="big">Aucun relevé</div>Saisis les prix vus en rayon ou en ligne.</div></td></tr>
                  ) : db.prices.slice().sort((a, b) => b.date.localeCompare(a.date)).map((r) => {
                    const prod = db.products.find((p) => p.id === r.pid);
                    const fl = floor(r.pid), diff = fl != null ? r.prix - fl : null;
                    const cls = diff == null ? "" : diff <= 0.001 ? "stock" : diff <= fl * 0.05 ? "watch" : "wait";
                    return (
                      <tr key={r.id}>
                        <td className="mono">{r.date}</td><td>{prod ? prod.nom : <i>(supprimé)</i>}</td><td>{r.enseigne || "—"}</td>
                        <td className="num">{eur(r.prix)}</td>
                        <td className="num">{diff == null ? "—" : <span className={`badge ${cls}`}>{diff <= 0.001 ? "plancher" : "+" + eur(diff)}</span>}</td>
                        <td style={{ textAlign: "right" }}><button className="icon-btn" onClick={() => delItem("prices", r.id)}>✕</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* AGENTS */}
        {tab === "agents" && <Agents db={db} set={set} uid={uid} today={today} eur={eur} />}

        {/* DONNEES */}
        {tab === "donnees" && (
          <section>
            <div className="toolbar"><div><h2>Données</h2><div className="sub">Stockées en local sur cet appareil. Export/import pour sauvegarder ou transférer.</div></div></div>
            <div className="row">
              <div className="card" style={{ flex: 1, minWidth: 260 }}>
                <h3>Sauvegarde & transfert</h3>
                <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 14px" }}>L'import remplace les données actuelles.</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn ghost" onClick={exportData}>Exporter (JSON)</button>
                  <label className="btn ghost" style={{ cursor: "pointer" }}>Importer (JSON)
                    <input type="file" accept="application/json" style={{ display: "none" }} onChange={importData} />
                  </label>
                </div>
              </div>
              <div className="card" style={{ flex: 1, minWidth: 260 }}>
                <h3>Réinitialisation</h3>
                <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 14px" }}>Efface tout le contenu de cet appareil.</p>
                <button className="btn danger" onClick={resetAll}>Tout réinitialiser</button>
              </div>
            </div>
          </section>
        )}

        <div className="foot">Cockpit Achats · appli privée · données locales à cet appareil</div>
      </main>

      {modal && (
        <Modal
          modal={modal} close={() => setModal(null)} db={db} set={set} uid={uid} today={today}
        />
      )}
    </>
  );
}

// ---------- AGENTS ----------
function Agents({ db, set, uid, today, eur }) {
  const [cat, setCat] = useState(AGENTS[0].id);
  const [produit, setProduit] = useState("");
  const [cible, setCible] = useState("");
  const [zone, setZone] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const agent = AGENTS.find((a) => a.id === cat);

  async function run() {
    if (!produit.trim()) { setErr("Indique un produit."); return; }
    setErr(""); setLoading(true);
    try {
      const r = await fetch("/api/agent", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentNom: agent.nom, focus: agent.focus, produit, cible, zone }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erreur");
      set((c) => c.findings.unshift({ ...d, id: uid(), cat: agent.id, catNom: agent.nom, date: today() }));
      setProduit(""); setCible("");
    } catch (e) {
      setErr(e.message === "Erreur" ? "La recherche n'a pas abouti." : e.message);
    } finally { setLoading(false); }
  }

  function toCockpit(f) {
    set((c) => {
      let prod = c.products.find((p) => p.nom.toLowerCase() === (f.produit || "").toLowerCase());
      if (!prod) {
        prod = { id: uid(), nom: f.produit || "Sans nom", type: "stockable", cat: f.catNom, cible: f.meilleur_prix ?? null };
        c.products.push(prod);
      }
      if (f.meilleur_prix != null) c.prices.push({ id: uid(), pid: prod.id, prix: f.meilleur_prix, enseigne: f.enseigne || "", date: today() });
    });
  }
  function remove(id) { set((c) => (c.findings = c.findings.filter((x) => x.id !== id))); }

  return (
    <section>
      <div className="hint">Chaque agent interroge le web <b>en direct au lancement</b> et renvoie le meilleur prix, la promo et le cashback du moment, avec les sources. Vérifie toujours le prix final chez le marchand avant d'acheter.</div>
      <div className="agents-grid">
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", marginBottom: 10 }}>Choisis l'agent</div>
          <div className="agent-list">
            {AGENTS.map((a) => (
              <button key={a.id} className={`agent-item ${a.id === cat ? "on" : ""}`} onClick={() => setCat(a.id)}>
                <span className="dot">{a.emoji}</span><span className="an">{a.nom}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="brief">
            <div className="head">
              <span className="dot">{agent.emoji}</span>
              <div><div style={{ fontWeight: 800 }}>Agent {agent.nom}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>Spécialité : {agent.focus}.</div></div>
            </div>
            <div className="inputs">
              <input value={produit} onChange={(e) => setProduit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !loading && run()} placeholder="Produit (ex : café en grains 1 kg)" />
              <input value={cible} onChange={(e) => setCible(e.target.value)} placeholder="Prix cible €" inputMode="decimal" />
              <input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Zone / enseigne" />
            </div>
            <button className="btn" style={{ marginTop: 12 }} onClick={run} disabled={loading}>
              {loading ? <><span className="spin" /> Recherche…</> : `Lancer l'agent`}
            </button>
            {err && <div className="err">{err}</div>}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", margin: "20px 0 10px" }}>Trouvailles</div>
          {db.findings.length === 0 ? (
            <div className="empty" style={{ border: "1px dashed var(--line)", borderRadius: 14, background: "#fff" }}>
              <div className="big">Aucune trouvaille</div>Choisis un agent et lance une recherche.
            </div>
          ) : db.findings.map((f) => (
            <div key={f.id} className="finding">
              <div className="top">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span className={`badge ${VERDICT[f.verdict] || "watch"}`}>{VLABEL[f.verdict] || f.verdict}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>{f.catNom}</span>
                  </div>
                  <div style={{ fontWeight: 700, marginTop: 6 }}>{f.produit}</div>
                  {f.commentaire && <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{f.commentaire}</div>}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div className="price">{f.meilleur_prix != null ? eur(f.meilleur_prix) : "—"}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{f.enseigne || "—"}</div>
                  {f.prix_ref_marche != null && <div style={{ fontSize: 11, color: "#a2abb6" }}>marché ~{eur(f.prix_ref_marche)}</div>}
                </div>
              </div>
              {(f.promo || f.cashback) && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 11 }}>
                  {f.promo && <span className="tag promo">Promo : {f.promo}</span>}
                  {f.cashback && <span className="tag cb">Cashback : {f.cashback}</span>}
                </div>
              )}
              <div className="src">
                {Array.isArray(f.sources) && f.sources.slice(0, 4).map((s, i) => (
                  <a key={i} href={s} target="_blank" rel="noreferrer">↗ {hostOf(s)}</a>
                ))}
                <span style={{ flex: 1 }} />
                <button className="icon-btn" onClick={() => toCockpit(f)} title="Envoyer au cockpit">→ Cockpit</button>
                <button className="icon-btn" onClick={() => remove(f.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- MODAL ----------
function Modal({ modal, close, db, set, uid, today }) {
  const [f, setF] = useState(modal.data || {});
  const upd = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const num = (v) => (v === "" || v == null ? null : parseFloat(String(v).replace(",", ".")));

  function saveProduct() {
    if (!f.nom || !f.nom.trim()) { alert("Nom requis."); return; }
    const obj = { nom: f.nom.trim(), cat: f.cat || "", unite: f.unite || "", type: f.type || "stockable", cible: num(f.cible), stock: num(f.stock), seuil: num(f.seuil), conso: num(f.conso) };
    set((c) => {
      if (f.id) Object.assign(c.products.find((x) => x.id === f.id), obj);
      else {
        obj.id = uid(); c.products.push(obj);
        if (num(f.plancher) != null) c.prices.push({ id: uid(), pid: obj.id, prix: num(f.plancher), enseigne: "référence", date: today() });
      }
    });
    close();
  }
  function saveReleve() {
    if (num(f.prix) == null) { alert("Prix requis."); return; }
    if (!f.pid) { alert("Choisis un produit."); return; }
    set((c) => c.prices.push({ id: uid(), pid: f.pid, prix: num(f.prix), enseigne: f.enseigne || "", date: f.date || today() }));
    close();
  }

  return (
    <div className="overlay open" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="modal">
        {modal.type === "product" && (
          <>
            <h3>{f.id ? "Éditer" : "Nouveau"} produit</h3>
            <div className="field"><label>Nom</label><input value={f.nom || ""} onChange={(e) => upd("nom", e.target.value)} placeholder="Café en grains 1 kg" autoFocus /></div>
            <div className="grid2">
              <div className="field"><label>Catégorie</label><input value={f.cat || ""} onChange={(e) => upd("cat", e.target.value)} /></div>
              <div className="field"><label>Unité</label><input value={f.unite || ""} onChange={(e) => upd("unite", e.target.value)} placeholder="kg, L, pièce" /></div>
            </div>
            <div className="field"><label>Conservation</label>
              <select value={f.type || "stockable"} onChange={(e) => upd("type", e.target.value)}>
                <option value="stockable">Stockable (longue conservation)</option>
                <option value="perissable">Périssable</option>
              </select>
            </div>
            <div className="grid2">
              <div className="field"><label>Prix plancher connu (€)</label><input type="number" step="0.01" value={f.plancher ?? ""} onChange={(e) => upd("plancher", e.target.value)} placeholder="optionnel" /></div>
              <div className="field"><label>Prix cible (€)</label><input type="number" step="0.01" value={f.cible ?? ""} onChange={(e) => upd("cible", e.target.value)} /></div>
            </div>
            <div className="grid2">
              <div className="field"><label>Stock actuel</label><input type="number" value={f.stock ?? ""} onChange={(e) => upd("stock", e.target.value)} /></div>
              <div className="field"><label>Seuil mini</label><input type="number" value={f.seuil ?? ""} onChange={(e) => upd("seuil", e.target.value)} /></div>
            </div>
            <div className="field"><label>Conso / mois (unités)</label><input type="number" step="0.5" value={f.conso ?? ""} onChange={(e) => upd("conso", e.target.value)} /></div>
            <div className="modal-actions"><button className="btn ghost" onClick={close}>Annuler</button><button className="btn" onClick={saveProduct}>Enregistrer</button></div>
          </>
        )}
        {modal.type === "releve" && (
          <>
            <h3>Nouveau relevé de prix</h3>
            <div className="field"><label>Produit</label>
              <select value={f.pid || ""} onChange={(e) => upd("pid", e.target.value)}>
                <option value="">— choisir —</option>
                {db.products.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            </div>
            <div className="grid2">
              <div className="field"><label>Prix (€)</label><input type="number" step="0.01" value={f.prix ?? ""} onChange={(e) => upd("prix", e.target.value)} autoFocus /></div>
              <div className="field"><label>Date</label><input type="date" value={f.date || today()} onChange={(e) => upd("date", e.target.value)} /></div>
            </div>
            <div className="field"><label>Enseigne / canal</label><input value={f.enseigne || ""} onChange={(e) => upd("enseigne", e.target.value)} placeholder="Leclerc, Amazon, drive…" /></div>
            <div className="modal-actions"><button className="btn ghost" onClick={close}>Annuler</button><button className="btn" onClick={saveReleve}>Enregistrer</button></div>
          </>
        )}
      </div>
    </div>
  );
}

function hostOf(u) { try { return new URL(u).hostname.replace("www.", ""); } catch { return "source"; } }
