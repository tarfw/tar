---
name: expenses
version: 1.0.0
module: expenses
tools: [create, read, update, link]
---

# Expenses Skill

## Purpose
Track business expenses, manage bills, handle recurring payments.

## Actions

### action_create_expense
Record an expense.

Steps:
1. `create(table='matter', type='expense', title='{description}', value={amount}, data:{category:{cat}, vendor:{vendor}, payment_method:{method}, status:'paid'}, scope='{scope}')`
2. `link(src='{scope}', tgt='{expenseId}', rel='has_expense')`
3. `create(table='motion', type='expense_recorded', data:{expenseId:{id}, title:{description}, amount:{amount}})`

### action_record_recurring
Set up a recurring expense.

Steps:
1. Same as create_expense with data:{recurring:true, recurring_interval:{interval}, due_date:{nextDate}}

### action_pay_expense
Mark an unpaid bill as paid.

Steps:
1. `read(table='matter', id='{expenseId}')`
2. `update(table='matter', id='{expenseId}', data:{...currentData, status:'paid', txn_id:{txn}})`
3. `create(table='motion', type='expense_paid', data:{expenseId:{id}, amount:{amount}})`

## Intent Matching

| User says | Action |
|---|---|
| record expense / spent | action_create_expense |
| recurring / rent / salary | action_record_recurring |
| paid bill / mark paid | action_pay_expense |
