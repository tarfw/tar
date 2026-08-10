/**
 * System Action Catalog.
 */

export const ACTION_CATALOG: Record<string, any> = {
  action_submit_contact: { id: 'action_submit_contact', label: 'Submit Contact Form' },
  action_submit_booking: { id: 'action_submit_booking', label: 'Submit Booking Form' },
  action_add_to_cart: { id: 'action_add_to_cart', label: 'Add to Cart' },
};

export function getActionIds() { return Object.keys(ACTION_CATALOG); }
export function isValidAction(id: string) { return Boolean(ACTION_CATALOG[id]); }
