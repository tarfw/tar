---
name: ecommerce
description: How to manage online stores, products, orders, and payments
---

# E-Commerce Skill

## Core Concepts

### Product
Item available for sale online.
- Has name, description, price
- Has images
- Has variants (size, color)
- Has stock per location
- Has SEO metadata

### Order
Customer purchase.
- Has line items
- Has shipping address
- Has payment status
- Has fulfillment status

### Cart
Session-based collection of items.
- Stored as motion stream
- Temporary until checkout

## Common Operations

### Create Product
1. action_create_product(name, price, stock, description, storeId)
2. Creates product + stock + embed

### Add to Cart
1. action_add_to_cart(sessionId, product, price, qty)
2. Appends to cart motion stream

### Checkout
1. action_checkout(storeId, items, email, paymentMethod)
2. Full checkout flow

### Process Payment
1. Create payment matter
2. Link to order
3. Update status

## Storefront

### Publishing
1. Generate layout via AI
2. Save to form.type='storefront'
3. Publish to CF Worker

### Templates
- streetwear-dark
- luxury-black
- minimal-white
- modern-gradient
- editorial

## Best Practices

### Product Descriptions
- Clear, detailed
- Include dimensions, materials
- SEO-optimized

### Checkout
- Minimize steps
- Show total clearly
- Multiple payment options
