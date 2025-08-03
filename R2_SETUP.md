# Cloudflare R2 Setup Guide

This guide will help you set up Cloudflare R2 for file uploads in your React Native app.

## Prerequisites

1. Cloudflare account
2. R2 subscription (has a free tier)

## Step 1: Create R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to R2 Object Storage
3. Click "Create bucket"
4. Choose a unique bucket name (e.g., `your-app-uploads`)
5. Select a region close to your users

## Step 2: Get R2 Credentials

1. In Cloudflare Dashboard, go to R2 → Manage R2 API tokens
2. Click "Create API token"
3. Choose "Custom token"
4. Set permissions:
   - Zone: Zone:Read
   - Account: Account:Read
   - R2: Edit (for your bucket)
5. Copy the generated credentials:
   - Account ID
   - Access Key ID
   - Secret Access Key

## Step 3: Configure Environment Variables

Add these to your `.env` file:

```env
# Cloudflare R2 Configuration
EXPO_PUBLIC_R2_ACCOUNT_ID=your_account_id_here
EXPO_PUBLIC_R2_ACCESS_KEY_ID=your_access_key_here
EXPO_PUBLIC_R2_SECRET_ACCESS_KEY=your_secret_key_here
EXPO_PUBLIC_R2_BUCKET_NAME=your-bucket-name
EXPO_PUBLIC_R2_REGION=auto
EXPO_PUBLIC_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
```

**Important**: Replace `your-account-id` in the endpoint with your actual Cloudflare account ID.

Example:
```env
EXPO_PUBLIC_R2_ENDPOINT=https://abc123def456.r2.cloudflarestorage.com
```

## Step 4: Install Dependencies

The required dependencies are already added to package.json:

```bash
npm install
```

## Step 5: Verify Configuration

1. Start your app: `npm start`
2. Go to ProductsAgent (Workspace → Products)
3. Check the console logs for R2 configuration status
4. You should see either:
   - ✅ "R2 configured successfully" (if properly set up)
   - ⚠️ "R2 not configured" (if using mock mode)

## Step 6: Test Upload

1. Go to ProductsAgent → Files tab
2. Try uploading an image or document
3. If R2 is configured, files will upload to your bucket
4. If not configured, it will use mock uploads (for development)

## Step 5: Set Up Backend Upload Handler (Production)

For production, you'll want to implement proper R2 uploads in your backend. Here's an example using AWS SDK (R2 is S3-compatible):

```typescript
// Example backend implementation (Node.js/Express)
import AWS from 'aws-sdk';
import multer from 'multer';

const r2 = new AWS.S3({
  endpoint: process.env.R2_ENDPOINT,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  region: 'auto',
  signatureVersion: 'v4',
});

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const key = `uploads/${Date.now()}-${file.originalname}`;
    
    const uploadParams = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };
    
    const result = await r2.upload(uploadParams).promise();
    
    res.json({
      success: true,
      url: result.Location,
      key: key,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
```

## Step 6: Configure CORS (Optional)

If you want to allow direct uploads from the client:

1. Go to your R2 bucket settings
2. Add CORS policy:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## Current Implementation

The current implementation includes:

1. **FileUpload Component**: Handles file picking and upload UI
2. **r2Service**: Manages upload/delete operations
3. **API Endpoints**: Backend handlers for secure uploads
4. **Mock Mode**: Works in development without R2 setup

## Development vs Production

- **Development**: Uses mock uploads (no R2 required)
- **Production**: Requires proper R2 setup and backend implementation

## File Types Supported

- **Images**: JPEG, PNG, GIF, WebP
- **Documents**: PDF, DOC, DOCX

## File Size Limits

- Maximum file size: 10MB per file
- Maximum files per upload: Configurable (default: 5 for images, 3 for documents)

## Security Considerations

1. Never expose R2 credentials in client-side code
2. Use backend API for uploads in production
3. Implement proper file validation
4. Set up appropriate CORS policies
5. Consider implementing signed URLs for temporary access

## Troubleshooting

### Common Issues:

1. **"Upload failed"**: Check your R2 credentials and bucket name
2. **CORS errors**: Ensure CORS is configured properly
3. **File too large**: Check file size limits
4. **Invalid file type**: Verify file type validation

### Debug Mode:

The app logs detailed information in development mode. Check the console for:
- Environment configuration status
- Upload progress
- Error details

## Next Steps

1. Set up your Cloudflare R2 bucket
2. Add environment variables
3. Test uploads in development (uses mock)
4. Implement production backend for secure uploads
5. Deploy and test in production

## Support

If you encounter issues:
1. Check the console logs
2. Verify environment variables
3. Test with mock uploads first
4. Check Cloudflare R2 dashboard for bucket status