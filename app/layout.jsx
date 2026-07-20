import "./globals.css";

export const metadata = {
  title: "Cockpit Achats",
  description: "Pilotage privé des bonnes opérations d'achat",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
