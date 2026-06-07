# Product Variants & Modifiers Data Model

This document outlines the test data configurations for Sneakers (Variants) and Pizza (Modifiers) matching the unified 4-table database schema defined in `plan.md`.

---

## Example 1: Sneakers (Options & Variants)

### 1. matter Table (Global Product & Store Identities)

| id | code | type | scope | owner | title | public | data | time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `sneakers` | `SNEAKERS01` | `product` | `g` | `sneakercompany` | `Everyday Sneakers` | `1` | `{"cat":"retail","p":"89.00","o":{"c":["Black","Red"],"s":["S","M"]}}` | `1780833600` |
| `s:101` | `TAMILSHOES` | `profile` | `g` | `sneakercompany` | `Tamil Shoes Store` | `1` | `{"cat":"store","cur":"INR"}` | `1780833600` |

### 2. mass Table (Local Store Realization)

| id | matter | type | scope | qty | value | active | geo | start | end | data | time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `sneakers0` | `sneakers` | `stock` | `s:101` | `10` | `89.00` | `1` | *NULL* | *NULL* | *NULL* | `{"o":{"c":"Black","s":"S"}}` | `1780833600` |
| `sneakers1` | `sneakers` | `stock` | `s:101` | `5` | `89.00` | `1` | *NULL* | *NULL* | *NULL* | `{"o":{"c":"Black","s":"M"}}` | `1780833600` |
| `sneakers2` | `sneakers` | `stock` | `s:101` | `8` | `95.00` | `1` | *NULL* | *NULL* | *NULL* | `{"o":{"c":"Red","s":"S"}}` | `1780833600` |
| `sneakers3` | `sneakers` | `stock` | `s:101` | `0` | `95.00` | `1` | *NULL* | *NULL* | *NULL* | `{"o":{"c":"Red","s":"M"}}` | `1780833600` |

### 3. relation Table (Global Store Associations)

| src | tgt | type | weight | time |
| :--- | :--- | :--- | :--- | :--- |
| `s:101` | `sneakers` | `assigned_to` | `1.0` | `1780833600` |

### 4. motion Table (Retail Ledger Opcodes)

| id | stream | seq | action | delta | scope | data | time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `mot01` | `sneakers0` | `1` | `101` | `-1.0` | `s:101` | `{"qty":1,"reason":"direct"}` | `1780833900` |
| `mot02` | `sneakers0` | `2` | `102` | `1.0` | `s:101` | `{"client":"usr10"}` | `1780834200` |
| `mot03` | `sneakers0` | `3` | `103` | `-1.0` | `s:101` | `{"client":"usr10"}` | `1780834500` |
| `mot03` | `sneakers0` | `3` | `104` | `0.0` | `s:101` | `{"step":"billing"}` | `1780834560` |
| `mot04` | `sneakers0` | `4` | `105` | `1.0` | `s:101` | `{"checkout":"web"}` | `1780834800` |
| `mot04` | `sneakers0` | `4` | `109` | `0.0` | `s:101` | `{"carrier":"express"}` | `1780835100` |
| `mot05` | `sneakers0` | `5` | `110` | `89.00` | `s:101` | `{"tax":12.00}` | `1780835400` |
| `mot06` | `sneakers0` | `6` | `111` | `-1.0` | `s:101` | `{"reason":"return"}` | `1780835700` |
| `mot07` | `sneakers0` | `7` | `201` | `89.00` | `s:101` | `{"payment":"cash"}` | `1780836000` |
| `mot08` | `sneakers0` | `8` | `405` | `-5.0` | `s:101` | `{"dest":"warehouse2"}` | `1780836300` |
| `mot09` | `sneakers0` | `9` | `406` | `10.0` | `s:101` | `{"source":"warehouse1"}` | `1780836600` |
| `mot10` | `sneakers0` | `10` | `801` | `89.00` | `s:101` | `{"method":"stripe"}` | `1780836900` |
| `mot10` | `sneakers0` | `10` | `802` | `89.00` | `s:101` | `{"ref":"ref123"}` | `1780836960` |
| `mot10` | `sneakers0` | `10` | `805` | `0.0` | `s:101` | `{"code":"nsf"}` | `1780837080` |

---

## Example 2: Pizza (Options & Modifiers)

### 1. matter Table (Global Product & Restaurant Identities)

| id | code | type | scope | owner | title | public | data | time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `pizza` | `PIZZA01` | `product` | `g` | `pizzacompany` | `Pepperoni Pizza` | `1` | `{"cat":"food","p":"12.00","o":{"s":["Small","Medium","Large"]}}` | `1780833600` |
| `extracheese` | `MODCHEESE` | `product` | `g` | `pizzacompany` | `Extra Cheese` | `1` | `{"mod":true}` | `1780833600` |
| `pepperoni` | `MODPEPPERONI` | `product` | `g` | `pizzacompany` | `Extra Pepperoni` | `1` | `{"mod":true}` | `1780833600` |
| `s:102` | `TAMILPIZZA` | `profile` | `g` | `pizzacompany` | `Tamil Pizza Shop` | `1` | `{"cat":"restaurant","cur":"INR"}` | `1780833600` |

### 2. mass Table (Local Restaurant Realization)

| id | matter | type | scope | qty | value | active | geo | start | end | data | time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `pizza0` | `pizza` | `stock` | `s:102` | `50` | `10.00` | `1` | *NULL* | *NULL* | *NULL* | `{"o":{"s":"Small"}}` | `1780833600` |
| `pizza1` | `pizza` | `stock` | `s:102` | `50` | `12.00` | `1` | *NULL* | *NULL* | *NULL* | `{"o":{"s":"Medium"}}` | `1780833600` |
| `pizza2` | `pizza` | `stock` | `s:102` | `50` | `15.00` | `1` | *NULL* | *NULL* | *NULL* | `{"o":{"s":"Large"}}` | `1780833600` |
| `pricecheese` | `extracheese` | `stock` | `s:102` | `9999` | `1.50` | `1` | *NULL* | *NULL* | *NULL* | `NULL` | `1780833600` |
| `pricepepperoni` | `pepperoni` | `stock` | `s:102` | `9999` | `2.00` | `1` | *NULL* | *NULL* | *NULL* | `NULL` | `1780833600` |

### 3. relation Table (Global Modifier Links)

| src | tgt | type | weight | time |
| :--- | :--- | :--- | :--- | :--- |
| `pizza` | `extracheese` | `parent-child` | `1.0` | `1780833600` |
| `pizza` | `pepperoni` | `parent-child` | `1.0` | `1780833600` |
| `s:102` | `pizza` | `assigned_to` | `1.0` | `1780833600` |

### 4. motion Table (Food & KDS Ledger Opcodes)

| id | stream | seq | action | delta | scope | data | time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `mot11` | `pizza0` | `1` | `101` | `-1.0` | `s:102` | `{"qty":1}` | `1780833900` |
| `mot12` | `pizza0` | `2` | `105` | `1.0` | `s:102` | `{"items":["pizza0"]}` | `1780834200` |
| `mot12` | `pizza0` | `2` | `106` | `0.0` | `s:102` | `{"staff":"mgr01"}` | `1780834320` |
| `mot12` | `pizza0` | `2` | `107` | `0.0` | `s:102` | `{"kitchen":"line1"}` | `1780834500` |
| `mot12` | `pizza0` | `2` | `206` | `0.0` | `s:102` | `{"station":"kds1"}` | `1780834560` |
| `mot12` | `pizza0` | `2` | `207` | `0.0` | `s:102` | `{"cook":"staff2"}` | `1780834800` |
| `mot12` | `pizza0` | `2` | `108` | `0.0` | `s:102` | `{"counter":"shelf3"}` | `1780834920` |
| `mot12` | `pizza0` | `2` | `109` | `0.0` | `s:102` | `{"handover":"customer"}` | `1780835100` |
| `mot13` | `pizza0` | `3` | `201` | `10.00` | `s:102` | `{"register":"till1"}` | `1780835400` |
| `mot14` | `pizza0` | `4` | `801` | `10.00` | `s:102` | `{"gateway":"card"}` | `1780835460` |
| `mot14` | `pizza0` | `4` | `802` | `10.00` | `s:102` | `{"ref":"tx992"}` | `1780835520` |
| `mot15` | `pricecheese` | `1` | `101` | `-1.0` | `s:102` | `{"reason":"pizza_topping"}` | `1780835700` |
