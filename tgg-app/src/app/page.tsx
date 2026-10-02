const services = [
  {
    name: 'TGG Source',
    role: 'Primary code host',
    url: process.env.TGG_SOURCE_URL ?? 'http://127.0.0.1:10030',
    discovery: '/.well-known/tgg-source.json',
    openapi: '/openapi.json',
  },
  {
    name: 'TGG Projects',
    role: 'Primary save ledger',
    url: process.env.TGG_PROJECTS_URL ?? 'http://127.0.0.1:10020',
    discovery: '/.well-known/tgg-projects.json',
    openapi: '/openapi.json',
  },
  {
    name: 'TGG Higgsfield',
    role: 'Creative generation',
    url: process.env.TGG_HIGGSFIELD_URL ?? 'http://127.0.0.1:10040',
    discovery: '/.well-known/tgg-higgsfield.json',
    openapi: '/openapi.json',
  },
  {
    name: 'TGG Video AI',
    role: 'Video analysis · AI edit · verified render',
    url: process.env.TGG_VIDEO_AI_PUBLIC_BASE_URL ?? 'http://127.0.0.1:10050',
    discovery: '/.well-known/tgg-video-ai.json',
    openapi: '/openapi.json',
  },
];

const trim = (value: string) => value.replace(/\/$/, '');

export default function Home() {
  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '48px 24px' }}>
      <p style={{ opacity: 0.65, letterSpacing: 2 }}>TGG OWNED PLATFORM</p>
      <h1 style={{ fontSize: 48, marginBottom: 12 }}>TGG App</h1>
      <p style={{ opacity: 0.8, maxWidth: 780 }}>
        TGG-owned source control, sealed project saving, game services, creative generation and production tooling.
      </p>

      <section
        style={{
          marginTop: 24,
          padding: 18,
          border: '1px solid #263047',
          borderRadius: 16,
          background: '#0d1420',
        }}
      >
        <strong>Canonical workflow</strong>
        <p style={{ marginBottom: 0, opacity: 0.75 }}>
          TGG Source → TGG Projects → TGG CI → TGG Runtime / Game. GitHub is legacy bootstrap/import only.
        </p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginTop: 32 }}>
        {services.map((service) => {
          const base = trim(service.url);
          return (
            <article key={service.name} style={{ border: '1px solid #263047', borderRadius: 16, padding: 20, background: '#111824' }}>
              <strong>{service.name}</strong>
              <div style={{ marginTop: 6, opacity: 0.7 }}>{service.role}</div>
              <div style={{ marginTop: 10, opacity: 0.65, overflowWrap: 'anywhere' }}>{base}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                <a href={base} style={{ color: '#9ec5ff' }}>Open app</a>
                <a href={base + service.discovery} style={{ color: '#9ec5ff' }}>Discovery</a>
                <a href={base + service.openapi} style={{ color: '#9ec5ff' }}>OpenAPI</a>
              </div>
            </article>
          );
        })}
      </section>

      <section style={{ marginTop: 32, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <a href="/video-studio" style={{ color: '#9ec5ff', fontWeight: 700 }}>Open TGG Video Studio</a>
        <a href="/api/apps" style={{ color: '#9ec5ff' }}>TGG App service discovery JSON</a>
      </section>
    </main>
  );
}
