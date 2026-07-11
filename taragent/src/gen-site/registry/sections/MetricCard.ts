import type { SiteSectionProps } from '../SiteRegistry';

export function renderMetricCard({ props, designTokens }: SiteSectionProps): string {
  const { title, value, icon, trend } = props;
  const { colors, rounded, spacing } = designTokens;

  return `
    <div style="background:${colors.primary || '#1B4332'}10;border-radius:${rounded.md || '12px'};padding:${spacing.md || '16px'};border:1px solid rgba(0,0,0,0.05);">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="color:${colors.secondary || colors.primary || '#2D6A4F'};font-size:12px;font-weight:500;">
          ${escapeHtml(title || 'Metric')}
        </span>
        ${icon ? `<span style="font-size:14px;">${escapeHtml(icon)}</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;margin-top:6px;">
        <span style="font-size:24px;font-weight:800;color:${colors.primary || '#1B4332'};">${escapeHtml(String(value ?? '0'))}</span>
        ${trend ? `<span style="margin-left:4px;font-size:12px;color:${trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#94a3b8'};">${trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}</span>` : ''}
      </div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
