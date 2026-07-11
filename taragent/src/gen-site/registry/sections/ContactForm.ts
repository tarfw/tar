import type { SiteSectionProps } from '../SiteRegistry';

export function renderContactForm({ props, designTokens }: SiteSectionProps): string {
  const { title, fields = ['name', 'email', 'message'], submitLabel = 'Send Message' } = props;
  const { colors, rounded, spacing } = designTokens;

  const fieldsHtml = fields
    .map((field: string) => {
      const label = field.charAt(0).toUpperCase() + field.slice(1);
      const isMessage = field === 'message';
      return `
        <div>
          <label style="display:block;font-weight:600;margin-bottom:${spacing.xs || '4px'};">${escapeHtml(label)}</label>
          ${isMessage
            ? `<textarea id="contact-${field}" required rows="4" style="width:100%;padding:${spacing.sm || '8px'};border-radius:${rounded.sm || '6px'};border:1px solid rgba(0,0,0,0.15);font-family:inherit;"></textarea>`
            : `<input type="${field === 'email' ? 'email' : 'text'}" id="contact-${field}" required style="width:100%;padding:${spacing.sm || '8px'};border-radius:${rounded.sm || '6px'};border:1px solid rgba(0,0,0,0.15);"/>`
          }
        </div>
      `;
    })
    .join('\n');

  return `
    <div class="container" style="max-width:600px;">
      ${title ? `<h2>${escapeHtml(title)}</h2>` : ''}
      <form id="contact-form" style="margin-top:${spacing.lg || '24px'};display:flex;flex-direction:column;gap:${spacing.md || '16px'};background:white;padding:${spacing.md || '16px'};border-radius:${rounded.md || '12px'};border:1px solid rgba(0,0,0,0.05);">
        ${fieldsHtml}
        <button type="submit" class="btn" style="width:100%;margin-top:12px;">${escapeHtml(submitLabel)}</button>
      </form>
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
