# Workspace Site Architecture & Action Plan (`workspacesite.md`)

## 1. Overview & Current State

### How to Access the Storefront in the App
1. Open the **Workspaces** tab in the mobile application.
2. At the top of your current active workspace (e.g. **Storea**), you will see the **Live Site Card** widget.
3. You can:
   - Tap **View** or type `show website` / `view site` in the input bar to open the in-app live site preview.
   - Tap **Publish** or type `publish website` in the input bar to deploy the current site draft to `https://storea.tarai.space/`.

### Why `https://storea.tarai.space/` Displays "Setting up"
When navigating to `https://storea.tarai.space/`, the browser currently displays:
> **Setting up**  
> *The workspace storea is currently being initialized.*

#### Root Cause Analysis:
1. **Missing Backend Worker Endpoints**:
   - On the frontend (`tarapp/src/hooks/use-site.ts`), clicking **Publish** sends a payload `{ subdomain, layout }` via `POST https://storea.tarai.space/publish`.
   - On the backend (`taragent/src/app.ts`), there is **no handler defined** for `POST /publish` or `POST /draft`.
2. **Fallback Trigger in Renderer**:
   - In `taragent/src/site-renderer.ts`, when a visitor opens `https://storea.tarai.space/`, the worker checks:
     - `site/layouts/home.json` in OKF/S3 storage.
     - Active revision in D1 `revisions` table.
     - KV cache `site_config:<subdomain>` (`DESIGN.md` / `site/pages.md`).
   - Because `POST /publish` never stored the published layout into KV/S3/D1, `site-renderer.ts` fails to find layout files and falls back to rendering the default HTML placeholder string: `"Setting up - The workspace storea is currently being initialized."`

---

## 2. Completed System Components

| Component | File / Location | Status | Functionality |
| :--- | :--- | :--- | :--- |
| **AI Site Generator** | `tarapp/src/lib/site-ai.ts` | **Completed** | Uses Groq LLM (`gpt-oss-120b`) to transform user prompts & product catalogs into structured JSON `SiteLayout` specs (templates, colors, fonts, sections, widgets). |
| **Local Draft & Published DB Storage** | `tarapp/src/hooks/use-site.ts` | **Completed** | Stores site layout drafts (`site_draft`) and published layouts (`site_published`) in SQLite `matter` table. |
| **In-App Site Preview** | `tarapp/src/components/cards/ResultCards.tsx` | **Completed** | Displays `SiteCard` widget and in-app webview preview for draft & published storefronts. |
| **Edge Subdomain Routing** | `taragent/src/app.ts` | **Completed** | Intercepts `*.tarai.space` requests and routes workspace subdomains to `site-renderer.ts`. |
| **Storefront Form API Handlers** | `taragent/src/app.ts` | **Completed** | Handles `POST /api/order`, `POST /api/booking`, `POST /api/contact` from public storefronts, writing directly into workspace Turso `matter` and `motion` tables to produce real-time mobile inbox notifications. |

---

## 3. Pending System Components & Action Plan

To achieve full end-to-end publishing and public storefront rendering for `https://<subdomain>.tarai.space/`, the following tasks are required:

### Task 1: Add `/publish` & `/draft` API Routes in Backend Worker (`taragent/src/app.ts`)
- Implement `POST /publish` route on the worker to receive `{ subdomain, layout }`.
- Store the published layout in:
  1. Cloudflare KV Cache (`STOREFRONT_CACHE`).
  2. Workspace S3 / OKF storage as `site/layouts/home.json`.
  3. D1 `revisions` table as active revision for the workspace.
- Implement `POST /draft` route to cache draft layouts for live previewing.

### Task 2: Update Edge Site Renderer (`taragent/src/site-renderer.ts`)
- Update `handleSiteRequest` to parse and render `SiteLayout` JSON objects directly:
  - Render themes: `streetwear-dark`, `luxury-black`, `minimal-white`, `modern-gradient`, `editorial`.
  - Render section components: `hero`, `announcement_bar`, `menu_grid`, `product_grid`, `service_list`, `hours`, `contact_form`, `testimonials`, `footer`.
  - Inject interactive JavaScript widgets: Cart, Checkout (`/api/order`), Booking (`/api/booking`), and Contact (`/api/contact`).

### Task 3: Automatic Initial Site Generation on Workspace Creation
- When a new workspace is created (e.g. **Storea**), automatically generate a default starter `SiteLayout` and publish it, ensuring every new workspace site is live immediately without showing the "Setting up" page.

### Task 4: Custom Domain & SSL Support
- Enable custom domain binding via `workspaces.custom_domain` in D1 so users can connect their own domains (e.g. `www.storea.com`) in addition to `storea.tarai.space`.

---

## 4. Architectural Sequence Diagram

```
+------------------+          +-------------------+          +-----------------------+          +------------------------+
|  Mobile App      |          |  Cloudflare       |          |  Cloudflare KV /      |          |  Public Web            |
|  (tarapp)        |          |  Worker           |          |  OKF Storage          |          |  Visitor               |
+--------+---------+          +---------+---------+          +-----------+-----------+          +-----------+------------+
         |                              |                                |                              |
         | 1. Tap Publish               |                                |                              |
         |----------------------------->|                                |                              |
         | POST /publish                |                                |                              |
         |                              | 2. Save layout JSON            |                              |
         |                              |------------------------------->|                              |
         | 3. HTTP 200 OK               |                                |                              |
         |<-----------------------------|                                |                              |
         |                              |                                |                              |
         |                              |                                | 4. Open storea.tarai.space   |
         |                              |<--------------------------------------------------------------|
         |                              | 5. Read layout & render HTML   |                              |
         |                              |------------------------------->|                              |
         |                              | 6. Serve responsive HTML page  |                              |
         |                              |-------------------------------------------------------------->|
         |                              |                                |                              |
```
