# AI Agents with Cloudflare Workers

Cloudflare Workers, Durable Objects, and Workers AI provide an ideal edge-native stack for building autonomous agents. These agents interact seamlessly with the TAR architecture (`matter`, `mass`, `motion`, `memory`).

## Agent Use Cases by Domain

### Product Catalog Agent
* **Domain:** Commerce
* **CF Tech Stack:** Workers AI
* **Use Case / Role:** Auto-generates product descriptions & specs from images.
* **TAR Integration:** Creates `matter` (type=product, bundle, variant)

#### Skills
| Skill | Description |
| :--- | :--- |
| Image Analysis | Analyzes product images to identify features, colors, and types. |
| Text Generation | Creates compelling, SEO-friendly product descriptions. |
| Metadata Extraction | Automatically extracts and structures specifications (size, weight). |
| Entity Generation | Converts AI text/images directly into structured `matter` entities (products, variants, bundles). |

### Smart Pricing Agent
* **Domain:** Commerce
* **CF Tech Stack:** Workers + KV
* **Use Case / Role:** Adjusts prices in real-time based on demand / stock.
* **TAR Integration:** Updates `mass.value` and `mass.startts`/`endts`

#### Skills
| Skill | Description |
| :--- | :--- |
| Real-time Calculation | Instantly recalculates pricing based on incoming signals. |
| Demand Forecasting | Analyzes trends to predict optimal price points. |
| Competitor Monitoring | Adjusts to market changes and competitor pricing strategies. |
| Time-Window Automation | Automates Flash Sales by updating `startts` and `endts` on `mass` entities. |
| Multi-store Pricing | Localizes pricing variants across different stores for the same `matter.code`. |

### Inventory Watcher
* **Domain:** Commerce
* **CF Tech Stack:** DO Alarms
* **Use Case / Role:** Auto-reorders stock when running low.
* **TAR Integration:** Monitors `mass.qty`, emits `REORDER` and `TRANSFER` motions

#### Skills
| Skill | Description |
| :--- | :--- |
| Threshold Monitoring | Continuously checks current stock levels against minimum thresholds. |
| Alarm Triggering | Uses Durable Object Alarms for precise, scheduled checks. |
| Reorder Automation | Automatically generates purchase orders or restocking requests. |
| Warehouse Transfer | Emits `TRANSFER_OUT` and `TRANSFER_IN` motions across hubs automatically. |

### Subscription & Booking Agent
* **Domain:** Commerce / Scheduling
* **CF Tech Stack:** Cron + Durable Objects
* **Use Case / Role:** Manages recurring billing, subscriptions, and appointment slots.
* **TAR Integration:** Emits `RENEWAL_DUE`, `BOOKED`, `CANCELLED` motions

#### Skills
| Skill | Description |
| :--- | :--- |
| Cycle Management | Triggers actions at end of subscription billing cycles. |
| Slot Masking | Marks `mass.available=0` when an appointment slot is booked. |
| Cancellation Handling | Automatically restores `mass.available=1` and initiates `REFUND` motions on cancel. |

### Content Writer Agent
* **Domain:** Content
* **CF Tech Stack:** Workers AI
* **Use Case / Role:** Drafts blog posts, articles, and notes automatically.
* **TAR Integration:** Creates `matter` (type=post/note)

#### Skills
| Skill | Description |
| :--- | :--- |
| Natural Language Generation | Writes fluent, human-like articles and blog posts. |
| Topic Research | Synthesizes information from provided prompts or outlines. |
| Tone Adaptation | Adjusts writing style to match the brand's voice. |

### Taxonomy Organizer
* **Domain:** Content
* **CF Tech Stack:** Workers AI + Vectorize
* **Use Case / Role:** Auto-categorizes items into collections & categories.
* **TAR Integration:** Creates `matter` (type=category/collection)

#### Skills
| Skill | Description |
| :--- | :--- |
| Semantic Grouping | Understands the meaning of items to group them logically. |
| Vector Search | Uses Vectorize to find similar items and existing categories. |
| Auto-Tagging | Generates relevant tags and labels for easy filtering. |

### Service Packager
* **Domain:** Services
* **CF Tech Stack:** Workers AI
* **Use Case / Role:** Drafts service offerings, scopes, and pricing tiers.
* **TAR Integration:** Creates `matter` (type=service, tutor, meal_plan)

#### Skills
| Skill | Description |
| :--- | :--- |
| Scope Definition | Clearly outlines what is included in a service offering. |
| Tier Structuring | Creates logical pricing tiers (Basic, Pro, Enterprise). |
| Copywriting | Writes engaging descriptions for service benefits. |
| Slot Generation | Pre-computes time slots (`startts`/`endts`) for bookable services. |

### Site Builder Agent
* **Domain:** Sites
* **CF Tech Stack:** Workers AI
* **Use Case / Role:** Generates landing pages, UI blocks, and theming.
* **TAR Integration:** Creates `matter` (type=page/store/section/banner/menu)

#### Skills
| Skill | Description |
| :--- | :--- |
| HTML/CSS Generation | Writes clean, responsive code for UI components. |
| Theming Configuration | Applies consistent brand colors, typography, and spacing. |
| Layout Optimization | Structures page sections for optimal user experience. |
| Navigation Setup | Auto-generates `matter` type `menu` with structured JSON payloads (`{items:[{label, href}]}`). |

### SEO Optimizer Agent
* **Domain:** Sites
* **CF Tech Stack:** Workers AI + Cron
* **Use Case / Role:** Auto-generates meta titles and descriptions.
* **TAR Integration:** Updates `matter` payload with metadata

#### Skills
| Skill | Description |
| :--- | :--- |
| Keyword Extraction | Identifies primary keywords from page content. |
| Meta Tag Generation | Creates concise, high-CTR titles and descriptions. |
| Content Scoring | Evaluates content for SEO best practices and readability. |

### Voice KDS Agent
* **Domain:** POS / In-Store
* **CF Tech Stack:** Workers AI (Whisper)
* **Use Case / Role:** Voice-controlled Kitchen Display System updates.
* **TAR Integration:** Transcribes to `ITEM_READY`, `TOKEN_ISSUED` motions

#### Skills
| Skill | Description |
| :--- | :--- |
| Speech-to-Text | Highly accurate transcription in noisy kitchen environments. |
| Intent Recognition | Understands commands like "Order 52 ready" or "Cancel burger". |
| Entity Extraction | Identifies order IDs, item names, and status updates. |
| Queue Management | Interacts with POS to advance tokens (`TOKEN_CALLED` -> `TOKEN_SERVED`). |

### Support Copilot
* **Domain:** CRM / Customers
* **CF Tech Stack:** Workers AI + Vectorize
* **Use Case / Role:** Auto-resolves customer queries using past data.
* **TAR Integration:** RAG via `memory`, writes `REPLY`, `TICKET_OPEN` motions

#### Skills
| Skill | Description |
| :--- | :--- |
| Conversational AI | Engages in natural, helpful dialogue with customers. |
| RAG (Retrieval) | Searches past tickets and knowledge base for solutions. |
| Sentiment Analysis | Detects customer frustration to escalate to a human agent. |
| Ticket Lifecycle | Manages state changes from `TICKET_OPEN` to `RESOLVED`. |

### Loyalty & CRM Agent
* **Domain:** CRM / Customers
* **CF Tech Stack:** Workers + Event Triggers
* **Use Case / Role:** Manages customer points, reviews, and birthday offers.
* **TAR Integration:** Updates `mass` (loyalty balance), emits `REVIEW`, `BIRTHDAY_OFFER_SENT`

#### Skills
| Skill | Description |
| :--- | :--- |
| Points Calculation | Computes loyalty points based on total spend and rules. |
| Feedback Parsing | Reads `REVIEW` payloads to identify complaints or high praise. |
| Lead Conversion | Tracks prospect journey from `LEAD_CREATED` to `CONVERTED`. |
| Segment Building | Auto-assigns customers to segments based on recency, frequency, and monetary (RFM) metrics. |

### Fleet Orchestrator
* **Domain:** Logistics
* **CF Tech Stack:** Durable Objects
* **Use Case / Role:** Real-time driver matching and ETA calculation.
* **TAR Integration:** Emits `DRIVER_ASSIGNED`, `ETA_UPDATED`, `DELIVERED` motions

#### Skills
| Skill | Description |
| :--- | :--- |
| Geospatial Routing | Calculates optimal paths based on distance and traffic. |
| Real-time Matching | Pairs the closest available driver with a delivery task. |
| Predictive ETA | Accurately estimates arrival times based on historical data. |
| Exception Handling | Parses `DELIVERY_ATTEMPT` payloads (e.g., customer unavailable) to trigger re-routes. |

### Roster & Reconciliation Agent
* **Domain:** Staff / HR
* **CF Tech Stack:** Workers AI + Cron
* **Use Case / Role:** Schedules staff, runs payroll math, and auto-closes daily registers.
* **TAR Integration:** Emits `TASK_ASSIGNED`, `PAYROLL`, `CASH_CLOSE` motions

#### Skills
| Skill | Description |
| :--- | :--- |
| Predictive Modeling | Forecasts busy periods using past sales and event data. |
| Shift Tracking | Monitors `CLOCK_IN` / `CLOCK_OUT` anomalies. |
| Ledger Reconciliation | Compares expected POS register values with actual cash count via `CASH_CLOSE` payload. |
| Payroll Calculation | Computes `PAYROLL` deltas automatically based on shift duration and role base pay. |

### Campaign Generator
* **Domain:** Marketing
* **CF Tech Stack:** Workers AI
* **Use Case / Role:** Auto-generates copy for SMS/Push notifications.
* **TAR Integration:** Creates `campaign`, `promo` matter & `PUSH_SENT` motion

#### Skills
| Skill | Description |
| :--- | :--- |
| Short-form Copywriting | Crafts punchy, engaging texts for SMS and Push. |
| A/B Test Formulation | Generates multiple `ab_variant` masses to test performance. |
| Audience Targeting | Matches message tone to specific customer segments. |
| Promo Allocation | Creates `promo` matter and configures `mass.qty` usage limits automatically. |

### Daily Insights Agent
* **Domain:** Analytics
* **CF Tech Stack:** Workers AI
* **Use Case / Role:** Summarizes daily sales and anomalies into reports.
* **TAR Integration:** Aggregates `SALE`, `VISIT` motions

#### Skills
| Skill | Description |
| :--- | :--- |
| Data Aggregation | Compiles thousands of daily transactions into key metrics (e.g., Top Products). |
| Anomaly Detection | Spots unusual patterns like sudden drops in sales or spikes in returns. |
| Executive Summarization | Translates data into plain-English, actionable insights. |
| Funnel Analysis | Identifies drop-offs in the cart conversion funnel (`VIEW` -> `CART` -> `CHECKOUT` -> `PAID`). |

### Fraud Guardian
* **Domain:** Payments
* **CF Tech Stack:** Workers AI
* **Use Case / Role:** Flags suspicious or rapid high-value transactions.
* **TAR Integration:** Analyzes `PAYMENT_INITIATED`, `PAYMENT_FAILED` motions

#### Skills
| Skill | Description |
| :--- | :--- |
| Pattern Recognition | Identifies common fraud vectors and unusual purchasing behaviors. |
| Velocity Checking | Monitors for unusually high frequencies of transactions from a single source. |
| Risk Scoring | Assigns a confidence score to transactions to automate block/allow decisions. |
| Failure Loop Detection | Flags consecutive `PAYMENT_FAILED` events (e.g., timeout loops) across user sessions. |

## Architecture Advantages
* **Zero Cold Starts**: Workers run on the edge for immediate agent responses.
* **Stateful Memory**: Durable Objects maintain contextual memory for ongoing workflows (e.g., Cart tracking, Fleet routing).
* **Built-in AI**: Workers AI enables running LLMs, Speech-to-Text, and Text Classification natively.
* **Low Latency**: Edge execution ensures agents make decisions geographically close to the user or POS device.
