import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Moteur des agents : Google Gemini (AI Studio) + recherche Google integree (grounding).
// 100% gratuit sur le tier gratuit, sans carte bancaire.
export async function POST(req) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY manquante." }, { status: 500 });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {}
  const { agentNom, focus, produit, cible, zone } = body;
  if (!produit || !produit.trim()) {
    return NextResponse.json({ error: "Produit requis." }, { status: 400 });
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const sys = `Tu es un agent d'achat specialise « ${agentNom} ». Ton terrain : ${focus}. Tu recherches sur le web les meilleures opportunites d'achat EN FRANCE, aujourd'hui. Sois factuel, appuie-toi sur les resultats de recherche, ne fabrique aucun prix. Reponds UNIQUEMENT avec un objet JSON valide, sans texte avant/apres ni backticks.`;
  const prompt = `Produit recherche : "${produit.trim()}".${cible ? ` Prix cible vise : ${cible} EUR.` : ""}${zone ? ` Zone / enseigne preferee : ${zone}.` : ""}
Recherche le meilleur prix actuel, les promotions en cours et le cashback applicable en France. Renvoie STRICTEMENT ce JSON :
{"produit":"nom precis","meilleur_prix":nombre ou null,"enseigne":"ou","prix_ref_marche":nombre ou null,"promo":"promo en cours ou vide","cashback":"app + taux applicable ou vide","verdict":"ACHETE|STOCKE|SURVEILLE|ATTENDS","commentaire":"1 phrase de conseil","sources":["url","url"]}
Regle verdict : ACHETE si prix<=cible ou nettement sous le marche ; STOCKE si prix exceptionnel sur produit stockable ; SURVEILLE si correct mais peut baisser ; ATTENDS si prix eleve.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.3 },
      }),
    });

    const data = await r.json();
    if (data.error) {
      return NextResponse.json({ error: data.error.message || "Erreur API Gemini." }, { status: 502 });
    }
    const cand = data.candidates && data.candidates[0];
    const text = (cand?.content?.parts || []).map((p) => p.text).filter(Boolean).join("\n");
    const parsed = extractJSON(text);
    if (!parsed) {
      return NextResponse.json({ error: "Reponse illisible." }, { status: 502 });
    }
    if (!Array.isArray(parsed.sources) || parsed.sources.length === 0) {
      const chunks = cand?.groundingMetadata?.groundingChunks || [];
      parsed.sources = chunks.map((c) => c?.web?.uri).filter(Boolean).slice(0, 4);
    }
    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json({ error: "La recherche a echoue." }, { status: 502 });
  }
}

function extractJSON(t) {
  if (!t) return null;
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s < 0 || e < 0) return null;
  try {
    return JSON.parse(t.slice(s, e + 1));
  } catch {
    return null;
  }
}
