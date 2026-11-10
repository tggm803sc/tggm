'use client';

import type { ReactNode } from 'react';

export function Badge({
  children,
  tone = 'demo',
}: {
  children: ReactNode;
  tone?: 'demo' | 'sim' | 'live' | 'ok' | 'warn';
}) {
  return <span className={'tgg-badge tgg-badge-' + tone}>{children}</span>;
}

export function Panel({
  title,
  subtitle,
  tag,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  tag?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="tgg-panel">
      <header className="tgg-panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="tgg-dim">{subtitle}</p> : null}
        </div>
        {tag ? <div className="tgg-panel-tag">{tag}</div> : null}
      </header>
      {children ? <div className="tgg-panel-body">{children}</div> : null}
      {footer ? <footer className="tgg-panel-foot">{footer}</footer> : null}
    </section>
  );
}

export function Btn({
  children,
  onClick,
  variant = 'default',
  disabled = false,
  wide = false,
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  wide?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={'tgg-btn tgg-btn-' + variant + (wide ? ' tgg-btn-wide' : '')}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      {children}
    </button>
  );
}

export function ScreenHead({
  id,
  title,
  subtitle,
  onBack,
}: {
  id: string;
  title: string;
  subtitle: string;
  onBack?: () => void;
}) {
  return (
    <header className="tgg-screen-head">
      <div className="tgg-screen-id">
        <span className="tgg-screen-num">{id}</span>
        <div>
          <h1>{title}</h1>
          <p className="tgg-dim">{subtitle}</p>
        </div>
      </div>
      <div className="tgg-head-actions">
        <Badge>DEMO</Badge>
        {onBack ? <Btn variant="ghost" onClick={onBack}>Back</Btn> : null}
      </div>
    </header>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="tgg-kv">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
