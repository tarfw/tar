import type { SiteSectionProps } from '../SiteRegistry';

export function renderHero({ props, designTokens }: SiteSectionProps): string {
  const { headline, subtext, ctaLabel, ctaAction } = props;
  const { colors, spacing } = designTokens;

  return `
    <div style="text-align:center;padding:${spacing.lg || '80px'} 20px;max-width:800px;margin:0 auto;">
      <h1 style="font-size:3rem;margin-bottom:${spacing.md || '16px'};color:${colors.primary || '#1B4332'};">
        ${escapeHtml(headline || 'Welcome')}
      </h1>
      ${subtext ? `<p style="font-size:1.25rem;color:rgba(0,0,0,0.6);margin-bottom:${spacing.lg || '24px'};">${escapeHtml(subtext)}</p>` : ''}
      ${ctaLabel ? `<a href="${escapeHtml(ctaAction || '#')}" class="btn">${escapeHtml(ctaLabel)}</a>` : ''}
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
