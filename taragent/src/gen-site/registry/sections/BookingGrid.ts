import type { SiteSectionProps } from '../SiteRegistry';

export function renderBookingGrid({ props, designTokens, data = [] }: SiteSectionProps): string {
  const { title, emptyMessage } = props;
  const { colors, rounded, spacing } = designTokens;

  if (data.length === 0) {
    return `
      <div class="container" style="max-width:800px;">
        ${title ? `<h2>${escapeHtml(title)}</h2>` : ''}
        <p style="color:#94a3b8;text-align:center;padding:24px;">${escapeHtml(emptyMessage || 'No bookings today')}</p>
      </div>
    `;
  }

  const slots = data
    .map(
      (booking: any) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid rgba(0,0,0,0.05);">
      <div>
        <strong>${escapeHtml(booking.data?.slot || booking.data?.time || '--:--')}</strong>
        <div style="color:#64748b;font-size:0.875rem;">${escapeHtml(booking.data?.customer || booking.title || 'Guest')}</div>
      </div>
      <span style="color:${colors.tertiary || '#D4A373'};font-size:0.875rem;">${escapeHtml(booking.data?.service || '')}</span>
    </div>`
    )
    .join('\n');

  return `
    <div class="container" style="max-width:800px;">
      ${title ? `<h2>${escapeHtml(title)}</h2>` : ''}
      <div style="background:white;border-radius:${rounded.md || '12px'};border:1px solid rgba(0,0,0,0.05);overflow:hidden;">
        ${slots}
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
