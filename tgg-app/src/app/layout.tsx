import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TGG App',
  description: 'TGG-owned source, projects, game and creative control plane',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#090b10', color: '#f5f7fb' }}>
        {children}
      </body>
    </html>
  );
}
