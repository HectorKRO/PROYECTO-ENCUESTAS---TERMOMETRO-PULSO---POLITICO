import './globals.css';
import { ServiceWorkerRegistrar } from './sw-register';
import { OrganizacionProvider } from '@/hooks/useOrganizacion';

export const metadata = {
  title:       'PulsoElectoral — Plataforma de Inteligencia Política',
  description: 'Sistema profesional de encuestas electorales con análisis en tiempo real y mapas de calor por sección electoral.',
  manifest:    '/manifest.json',
  icons: { icon: '/favicon.ico', apple: '/icons/icon-192.png' },
};

export const viewport = {
  themeColor: '#07100a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <OrganizacionProvider>
          {children}
        </OrganizacionProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
