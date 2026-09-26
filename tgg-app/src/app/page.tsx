const services = [
  ['TGG Source', process.env.TGG_SOURCE_URL ?? 'http://127.0.0.1:10030'],
  ['TGG Projects', process.env.TGG_PROJECTS_URL ?? 'http://127.0.0.1:10020'],
  ['TGG Higgsfield', process.env.TGG_HIGGSFIELD_URL ?? 'http://127.0.0.1:10040'],
];

export default function Home() {
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>
      <p style={{ opacity: 0.65, letterSpacing: 2 }}>TGG OWNED PLATFORM</p>
      <h1 style={{ fontSize: 48, marginBottom: 12 }}>TGG App</h1>
      <p style={{ opacity: 0.8, maxWidth: 760 }}>
        TGG-owned source control, project saving, game services, creative generation and production tooling.
      </p>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16, marginTop: 32 }}>
        {services.map(([name, url]) => (
          <article key={name} style={{ border: '1px solid #263047', borderRadius: 16, padding: 20, background: '#111824' }}>
            <strong>{name}</strong>
            <div style={{ marginTop: 8, opacity: 0.65, overflowWrap: 'anywhere' }}>{url}</div>
          </article>
        ))}
      </section>
    </main>
  );
}
