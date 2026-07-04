---
name: documents
description: How to upload, store, link, and retrieve documents and file attachments
---

# Documents Skill

## Core Concepts

### Document
A file stored in Railway S3, tracked as `matter` with `type='document'`.
- `data` = `{ fileName, mimeType, sizeBytes, storageKey, uploadedBy, linkedTo }`

### Storage Key Pattern
`{scope}/{category}/{year}/{month}/{docId}.{ext}`

## Common Operations (6-Tool Pattern)

### Upload Document
1. Client sends file to `POST /documents/upload`
2. Worker uploads to Railway S3
3. `create(table='matter', type='document', title='{fileName}', data:{fileName, mimeType, sizeBytes, storageKey, uploadedBy}, scope='{scope}')`
4. `link(src='{scope}', rel='has_document', tgt='{docId}')`
5. Returns: `{ docId, url, fileName, size }`

### Attach to Expense
1. Upload document or use existing docId
2. `link(src='{expenseId}', rel='attached_to', tgt='{docId}')`
3. `update(table='matter', id='{expenseId}', patch:{data:{...currentData, receiptDocId: docId}})`

### Attach to Order
1. Upload invoice/receipt document
2. `link(src='{orderId}', rel='attached_to', tgt='{docId}')`

### Download / View
1. `read(table='matter', id='{docId}')` — get storageKey
2. Generate presigned URL from Railway S3 (valid for 1 hour)
3. Return URL to client

### List Documents for Workspace
1. `read(table='matter', type='document', scope='{scope}', active=1)`

### Delete Document
1. `update(table='matter', id='{docId}', patch:{active: 0})`
2. File remains in Railway S3 (cleanup cron removes after 30 days)

## File Types & Limits

| Type | Max Size | Extensions |
|---|---|---|
| Receipts/invoices | 5 MB | pdf, jpg, png, webp |
| Documents | 10 MB | pdf, doc, docx, xls, xlsx, csv |
| Images | 10 MB | jpg, png, webp, gif |

## Best Practices

- Always link documents to parent matter via `graph(rel='attached_to')`
- Use storage key pattern for organization
- Soft-delete documents, don't hard-delete
- Generate presigned URLs for downloads
