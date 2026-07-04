---
name: expenses
description: How to track expenses, manage bills, handle recurring payments, and generate expense reports
---

# Expenses Skill

## Core Concepts

### Expense
A business expense stored as `matter` with `type='expense'`.
- `value` = expense amount
- `data` = `{ category, vendor, paymentMethod, txn_id, status, recurring, dueDate }`

### Categories
rent, salary, utilities, supplies, marketing, maintenance, transport, misc

## Common Operations (6-Tool Pattern)

### Record Expense
1. `create(table='matter', type='expense', title='{description}', value={amount}, data:{category, vendor, paymentMethod, status:'paid'}, scope='{scope}')`
2. `link(src='{scope}', rel='has_expense', tgt='{expenseId}')`
3. `create(table='motion', stream:'{expenseId}', action:99993, data:{event:'expense_recorded', title, amount}, scope='{scope}')`

### Record Recurring Expense
1. Same as above, with `data:{recurring:true, recurringInterval:'monthly', dueDate:'{nextDate}'}`

### Pay Unpaid Bill
1. `read(table='matter', id='{expenseId}')` — get current data
2. `update(table='matter', id='{expenseId}', patch:{data:{...currentData, status:'paid', txnId:'{reference}'}})`
3. `create(table='motion', stream:'{expenseId}', action=99993, data:{event:'expense_paid'}, scope='{scope}')`

### Monthly Expense Summary
1. `read(table='matter', type='expense', scope='{scope}', limit:200)`
2. Group by `data.category` → sum `value`

### Outstanding Bills
1. `read(table='matter', type='expense', scope='{scope}', filters:[{key:'status', val:'unpaid'}])`
2. Sort by `data.dueDate` ASC

### List Expenses
1. `read(table='matter', type='expense', scope='{scope}', limit:100)`

## Best Practices

- Always categorize expenses at time of recording
- Set recurring flag for rent, salaries, subscriptions
- Link expenses to suppliers via `graph(rel='supplies')`
- Use `data.status`: paid, unpaid
