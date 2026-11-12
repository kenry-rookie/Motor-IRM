import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Barlow_Condensed, IBM_Plex_Sans } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Motor IRM",
  description: "Administración de taller y venta de repuestos de motocicletas",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

// Color de la barra del navegador en el celular
export const viewport: Viewport = {
  themeColor: "#ffffff",
};

// Texto corrido: legible y con cifras tabulares para montos y cantidades.
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

// Títulos y menú: condensada, de rotulación industrial.
const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${plex.variable} ${barlow.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )irm_theme=([^;]+)/);if(m&&m[1]==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>

      <body className="bg-neutral-950 text-neutral-100 antialiased">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}