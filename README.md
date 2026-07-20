# Cockpit Achats — appli web privée, 100% gratuite

Ton système d'achats malins, hébergé sur **ton** URL, protégé par mot de passe,
accessible depuis n'importe quel appareil. **Sans aucune carte bancaire.**

- **Agents live** : 6 agents spécialisés (épicerie, entretien, bébé, high-tech,
  beauté, bricolage) qui recherchent le web en direct (via Google) et renvoient
  meilleur prix + promo + cashback + sources.
- **Cockpit** : registre de tes produits (plancher, stock, seuils) avec moteur de
  signal d'achat.
- **Pont** : le bouton « → Cockpit » transforme une trouvaille d'agent en relevé de prix.

La clé API reste **côté serveur** (route serverless) — jamais exposée au navigateur.

---

## La pile 100% gratuite

| Brique | Service | Coût |
|---|---|---|
| Hébergement | Vercel — plan **Hobby** | Gratuit, sans carte, usage perso |
| Moteur des agents | **Google Gemini** (AI Studio) + recherche Google | Gratuit (quotas) |
| Code source | GitHub | Gratuit |

Limites du gratuit à connaître : ~1 000 requêtes/jour et quelques requêtes/minute
côté Gemini (large pour un usage familial) ; sur le tier gratuit Gemini, Google peut
utiliser les données pour améliorer ses produits (sans importance pour des prix).

---

## Déploiement pas à pas (tout dans le navigateur, ~10 min)

### 1. Clé API Gemini (gratuite, sans carte)
1. Va sur **https://aistudio.google.com/apikey** et connecte-toi avec un compte Google.
2. Clique **Create API key** → copie la clé `AIza…` et garde-la de côté.

### 2. Mettre le code sur GitHub
1. Décompresse le dossier `cockpit-achats`.
2. Sur **github.com** : crée un compte, puis **New repository** → nom `cockpit-achats`,
   coche **Private**, **Create repository**.
3. Sur la page du repo vide, clique **uploading an existing file**.
4. Sélectionne **tout le contenu** du dossier `cockpit-achats` (fichiers + dossier `app`)
   et **glisse-dépose** dans la zone. La structure des dossiers est conservée.
5. **Commit changes**.

### 3. Déployer sur Vercel
1. Va sur **vercel.com** → **Sign Up** → **Continue with GitHub**.
2. **Add New… → Project** → importe ton repo `cockpit-achats`.
3. Framework détecté : **Next.js** (ne touche à rien).
4. Ouvre **Environment Variables** et ajoute :

| Name | Value |
|---|---|
| `GEMINI_API_KEY` | ta clé `AIza…` |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `APP_PASSWORD` | le mot de passe pour entrer |
| `APP_SESSION_SECRET` | une longue chaîne aléatoire (≠ du mot de passe) |

5. **Deploy**. Après ~1 min tu obtiens `https://cockpit-achats-xxxx.vercel.app`.

### 4. Premier test
1. Ouvre l'URL → page de connexion → saisis ton `APP_PASSWORD`.
2. Onglet **Agents live** → choisis un agent, tape un produit, **Lancer l'agent**.
   La première recherche prend 10–20 s.

---

## Lancer en local (optionnel)
```bash
npm install
cp .env.example .env.local   # renseigne les 4 variables
npm run dev                  # http://localhost:3000
```

---

## Dépannage
- **L'agent renvoie une erreur** : presque toujours la clé Gemini (mal collée) ou le
  nom du modèle. Change `GEMINI_MODEL` (essaie `gemini-flash-latest`) dans
  Vercel → **Settings → Environment Variables**, puis **Deployments → ⋯ → Redeploy**.
- **Après avoir changé une variable** : Vercel ne l'applique qu'au prochain déploiement
  (Redeploy).
- **Données** : stockées dans le navigateur de chaque appareil (localStorage). L'onglet
  **Données** permet export/import JSON pour sauvegarder ou transférer.
- Pour une **synchro auto multi-appareils**, il faut ajouter une base gratuite (ex.
  Upstash Redis) + une route `/api/data`. Évolution possible — demande-la si tu veux.
