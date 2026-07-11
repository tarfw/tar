import type { SiteSectionProps } from '../SiteRegistry';

export function renderCatalogGrid({ props, designTokens, data = [] }: SiteSectionProps): string {
  const { title, columns = 2, emptyMessage } = props;
  const { colors, rounded, spacing } = designTokens;

  if (data.length === 0) {
    return `
      <div class="container">
        ${title ? `<h2>${escapeHtml(title)}</h2>` : ''}
        <p style="color:#94a3b8;text-align:center;padding:24px;">${escapeHtml(emptyMessage || 'No items')}</p>
      </div>
    `;
  }

  const cards = data
    .map(
      (item: any) => `
    <div class="card">
      <div style="height:200px;background:${colors.secondary || '#2D6A4F'};display:flex;align-items:center;justify-content:center;color:white;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      </div>
      <div class="card-body">
        <div>
          <h3 class="card-title">${escapeHtml(item.title || item.name || 'Product')}</h3>
          <p style="color:rgba(0,0,0,0.6);font-size:0.9rem;margin-bottom:${spacing.sm || '8px'};">
            ${escapeHtml(item.description || 'Quality product')}
          </p>
        </div>
        <div>
          <div class="card-price">$${item.price ?? item.value ?? '0.00'}</div>
        </div>
      </div>
    </div>`
    )
    .join('\n');

  return `
    <div class="container">
      ${title ? `<h2>${escapeHtml(title)}</h2>` : ''}
      <div class="grid" style="grid-template-columns:repeat(${columns},1fr);">${cards}</div>
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
