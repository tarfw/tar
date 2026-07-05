import { createMatter, setAttr, appendMotion, readForm } from '@/lib/helpers';

/**
 * Log a support or service ticket with notification.
 * @param input - Ticket details
 * @param input.title - Ticket title (required, non-empty)
 * @param input.description - Description (optional)
 * @param input.priority - Priority: low, medium, high, urgent (optional)
 * @param input.scope - Tenant scope
 * @returns Ticket matter ID
 */
export async function actionCreateTicket(input: {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  scope: string;
}): Promise<{ ticketId: string }> {
  const ticketId = `ticket_${Date.now()}`;
  await createMatter({
    table: 'matter', scope: input.scope, type: 'ticket',
    title: input.title, data: { description: input.description, priority: input.priority },
  });

  await setAttr({ matterId: ticketId, key: 'status', val: 'open', scope: input.scope });
  await setAttr({ matterId: ticketId, key: 'priority', val: input.priority || 'medium', scope: input.scope });

  await appendMotion({
    stream: ticketId, action: 99993,
    data: { event: 'ticket_created', title: input.title, priority: input.priority },
    scope: input.scope,
  });

  const channelResult = await readForm({ scope: input.scope, type: 'channel' });
  const channelConfig = channelResult.rows.find(
    (r: any) => r.id === 'slack' || r.data?.provider === 'slack'
  );
  if (channelConfig) {
    console.log(`Found channel config for slack, would send via provider`);
  }
  await appendMotion({
    stream: 'support-team', action: 99993,
    data: { event: 'notification', channel: 'slack', template: 'ticket-created', ticketId, title: input.title },
    scope: input.scope,
  });

  return { ticketId };
}
