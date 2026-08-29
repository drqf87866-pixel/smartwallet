import type { FC, PropsWithChildren } from 'hono/jsx';

type LayoutProps = PropsWithChildren<{ title: string }>;

const swScript = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
`;

export const Layout: FC<LayoutProps> = ({ title, children }) => (
  <html lang="de">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <title>{title} · SmartWallet</title>
      <meta name="theme-color" content="#4f46e5" />
      <link rel="manifest" href="/manifest.webmanifest" />
      <link rel="icon" href="/assets/icon-192.png" type="image/png" />
      <link rel="apple-touch-icon" href="/assets/icon-192.png" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="SmartWallet" />
      <link rel="stylesheet" href="/assets/app.css" />
      <style>{`body { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }`}</style>
    </head>
    <body class="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50 to-slate-100 text-slate-800 antialiased">
      {children}
      <script dangerouslySetInnerHTML={{ __html: swScript }} />
    </body>
  </html>
);
