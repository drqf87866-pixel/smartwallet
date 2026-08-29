import type { FC, PropsWithChildren } from 'hono/jsx';

type LayoutProps = PropsWithChildren<{ title: string }>;

const TAILWIND_CDN = 'https://cdn.tailwindcss.com';

export const Layout: FC<LayoutProps> = ({ title, children }) => (
  <html lang="de">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title} · SmartWallet</title>
      <script src={TAILWIND_CDN}></script>
      <style>{`body { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }`}</style>
    </head>
    <body class="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50 to-slate-100 text-slate-800 antialiased">
      {children}
    </body>
  </html>
);
