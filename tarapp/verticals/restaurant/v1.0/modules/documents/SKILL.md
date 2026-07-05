---
name: documents
version: 1.0.0
module: documents
tools: [create, read, update, link]
---

# Documents Skill

## Purpose
Upload, store, link, and retrieve files (receipts, invoices, images).

## Actions

### action_upload_document
Upload a file to Railway S3 and create a document record.

Steps:
1. Client sends file to `POST /documents/upload`
2. Worker uploads to S3 at `{scope}/{category}/{year}/{month}/{docId}.{ext}`
3. `create(table='matter', type='document', title='{fileName}', data:{file_name:{name}, mime_type:{mime}, size_bytes:{size}, storage_key:{key}}, scope='{scope}')`
4. `link(src='{scope}', tgt='{docId}', rel='has_document')`

### action_link_document
Attach an existing document to any matter.

Steps:
1. `link(src='{parentId}', tgt='{docId}', rel='attached_to')`
2. `update(table='matter', id='{parentId}', data:{...currentData, receipt_doc_id:{docId}})`

### action_download_document
Get a presigned URL for download.

Steps:
1. `read(table='matter', id='{docId}')` — get storage_key
2. Generate presigned URL from S3 (valid 1 hour)
3. Return URL to client

## Intent Matching

| User says | Action |
|---|---|
| upload / attach file / receipt | action_upload_document |
| link document / attach to | action_link_document |
| download / get file / view | action_download_document |
