import type { SiteSectionProps } from '../SiteRegistry';

export function renderContentCard({ props, designTokens }: SiteSectionProps): string {
  const { title, body, imageUrl, ctaLabel, ctaAction } = props;
  const { colors, rounded, spacing } = designTokens;

  return `
    <div style="background:white;border-radius:${rounded.md || '12px'};border:1px solid rgba(0,0,0,0.05);overflow:hidden;margin-bottom:${spacing.lg || '24px'};">
      ${imageUrl ? `<div style="height:200px;background:url('${escapeHtml(imageUrl)}') center/cover;background-color:${colors.secondary || '#e2e8f0'};"></div>` : ''}
      <div style="padding:${spacing.md || '16px'};">
        ${title ? `<h3 style="font-size:1.25rem;margin-bottom:8px;color:${colors.primary || '#111'};">${escapeHtml(title)}</h3>` : ''}
        ${body ? `<p style="color:#64748b;line-height:1.6;">${escapeHtml(body)}</p>` : ''}
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
