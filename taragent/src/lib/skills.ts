/**
 * Skills registry — bundles SKILL.md content for agent context.
 * In production, these will be read from S3. For now, embedded.
 */

export const RESTAURANT_SKILLS = `
# Orders Skill
Handle POS: create orders, record payments, confirm, cancel.

Actions:
- action_create_order: create(table='matter', type='order', value={total}, data:{items, customer, payment_method})
- action_confirm_order: update(table='matter', id={orderId}, data:{status:'confirmed'})
- action_cancel_order: update(table='matter', id={orderId}, data:{status:'cancelled'}) + restore stock
- action_record_payment: update(table='matter', id={orderId}, data:{payment_status:'paid'})

Intent: order/sell/record sale → create_order. confirm order → confirm_order. cancel → cancel_order. paid/payment → record_payment.

# Inventory Skill
Track stock, suppliers, expiry, prevent oversell.

Actions:
- action_add_product: create(table='matter', type='product', title={name}, qty={qty}, value={price})
- action_update_stock: read then update matter.qty
- action_deduct_stock: read then update matter.qty (subtract)
- action_check_low_stock: read matter where qty <= min_stock

Intent: add product/new item → add_product. restock/add quantity → update_stock. low stock/running out → check_low_stock.

# CRM Skill
Track customers, leads, follow-ups.

Actions:
- action_create_lead: create(table='matter', type='lead', title={name}, data:{phone})
- action_follow_up: create(table='motion', type='follow_up', data:{leadId, dueDate})

Intent: new customer/add lead → create_lead. follow up/remind → follow_up.

# Bookings Skill
Table reservations, scheduling.

Actions:
- action_create_booking: create(table='matter', type='booking', data:{date, time, party_size, customer})
- action_cancel_booking: update(table='matter', id={bookingId}, active=0)

Intent: book/reserve/table for → create_booking. cancel reservation → cancel_booking.

# Reports Skill
Sales, stock, tax summaries.

Actions:
- action_report_daily_sales: read matter type='order' where start >= today
- action_report_stock_valuation: read matter type='product' → SUM(qty x value)
- action_report_low_stock: read matter type='product' → filter qty <= min_stock

Intent: today's sales/how much sold → daily_sales. stock value/inventory worth → stock_valuation. low stock → low_stock.

# Expenses Skill
Track spending, bills, recurring.

Actions:
- action_create_expense: create(table='matter', type='expense', value={amount}, data:{category, vendor})
- action_record_recurring: same with data:{recurring:true, recurring_interval}

Intent: record expense/spent → create_expense. recurring/rent/salary → record_recurring.

# Documents Skill
Upload files, receipts, invoices.

Actions:
- action_upload_document: POST /documents/upload → create matter type='document'
- action_link_document: link(src={parentId}, tgt={docId}, rel='attached_to')

Intent: upload/attach file/receipt → upload_document. link document → link_document.
`;

export const SKILLS_BY_VERTICAL: Record<string, string> = {
  restaurant: RESTAURANT_SKILLS,
  salon: RESTAURANT_SKILLS,
  clinic: RESTAURANT_SKILLS,
  retail: RESTAURANT_SKILLS,
  courier: RESTAURANT_SKILLS,
  agency: RESTAURANT_SKILLS,
};

export function getSkillsForVertical(vertical: string): string {
  return SKILLS_BY_VERTICAL[vertical] || RESTAURANT_SKILLS;
}
