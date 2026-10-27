import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Neulis Alt em todo o sistema — mesma família pros dois papéis
// (display/body), só variando peso, no lugar de Space Grotesk + Inter.
const display = localFont({
  src: [
    { path: "../public/fonts/NeulisAlt-SemiBold.otf", weight: "600", style: "normal" },
    { path: "../public/fonts/NeulisAlt-Bold.otf", weight: "700", style: "normal" },
    { path: "../public/fonts/NeulisAlt-ExtraBold.otf", weight: "800", style: "normal" },
  ],
  variable: "--font-display",
});

const body = localFont({
  src: [
    { path: "../public/fonts/NeulisAlt-Regular.otf", weight: "400", style: "normal" },
    { path: "../public/fonts/NeulisAlt-Italic.otf", weight: "400", style: "italic" },
    { path: "../public/fonts/NeulisAlt-Medium.otf", weight: "500", style: "normal" },
    { path: "../public/fonts/NeulisAlt-SemiBold.otf", weight: "600", style: "normal" },
  ],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "CRM Aventure",
  description: "CRM de prospecção, funil e metas",
  // Ícone real (símbolo "a!") ao adicionar à tela inicial — sem isso,
  // iOS/Android usam um print da tela como ícone do "app".
  icons: {
    icon: "/icon.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CRM Aventure",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
