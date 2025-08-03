// R2 Service for file management with Cloudflare R2
import { getR2Config } from '../config/env';
import * as CryptoJS from 'crypto-js';
import * as FileSystem from 'expo-file-system';

export interface R2UploadResult {
  key: string;
  url: string;
  filename: string;
  size: number;
  contentType: string;
}

export interface FileToUpload {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

class R2Service {
  private config: ReturnType<typeof getR2Config> | null = null;

  constructor() {
    try {
      this.config = getR2Config();
      console.log('R2 Service initialized with config:', {
        bucket: this.config.bucketName,
        endpoint: this.config.endpoint,
        hasCredentials: !!(this.config.accessKeyId && this.config.secretAccessKey)
      });
    } catch (error) {
      console.warn('R2 configuration not available:', error);
      this.config = null;
    }
  }

  private async createAwsSignature(method: string, key: string, contentType: string, timestamp: string): Promise<{ authorization: string; date: string }> {
    if (!this.config) {
      throw new Error('R2 not configured');
    }

    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const dateTime = timestamp;
    const region = 'auto';
    const service = 's3';
    
    // Clean the endpoint to get the hostname
    const hostname = this.config.endpoint.replace('https://', '').replace('http://', '');
    const host = `${this.config.bucketName}.${hostname}`;
    
    // Create canonical request
    const canonicalUri = encodeURI(`/${key}`).replace(/\+/g, '%20');
    const canonicalQueryString = '';
    const canonicalHeaders = [
      `host:${host}`,
      `x-amz-content-sha256:UNSIGNED-PAYLOAD`,
      `x-amz-date:${dateTime}`
    ].join('\n') + '\n';
    
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const payloadHash = 'UNSIGNED-PAYLOAD';
    
    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');
    
    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${date}/${region}/${service}/aws4_request`;
    const stringToSign = [
      algorithm,
      dateTime,
      credentialScope,
      CryptoJS.SHA256(canonicalRequest).toString()
    ].join('\n');
    
    // Calculate signature
    const kDate = CryptoJS.HmacSHA256(date, `AWS4${this.config.secretAccessKey}`);
    const kRegion = CryptoJS.HmacSHA256(region, kDate);
    const kService = CryptoJS.HmacSHA256(service, kRegion);
    const kSigning = CryptoJS.HmacSHA256('aws4_request', kService);
    const signature = CryptoJS.HmacSHA256(stringToSign, kSigning).toString();
    
    const authorization = `${algorithm} Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    return { authorization, date: dateTime };
  }

  async uploadFile(file: FileToUpload, folder: string = 'uploads'): Promise<R2UploadResult> {
    if (!this.config) {
      throw new Error('Cloudflare R2 is not configured. Please check your environment variables.');
    }

    try {
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `${folder}/${timestamp}-${sanitizedName}`;
      
      console.log('Starting R2 upload:', {
        key,
        contentType: file.type,
        size: file.size,
        uri: file.uri
      });

      // Generate public URL
      const hostname = this.config.endpoint.replace('https://', '').replace('http://', '');
      const publicUrl = `https://${this.config.bucketName}.${hostname}/${key}`;
      
      console.log('Upload URL:', publicUrl);
      
      // Create AWS v4 signature
      const awsTimestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
      const { authorization, date } = await this.createAwsSignature('PUT', key, file.type, awsTimestamp);
      
      // Create FormData for React Native file upload
      const formData = new FormData();
      
      // Properly format the file for React Native FormData
      const fileForUpload = {
        uri: file.uri,
        type: file.type,
        name: file.name,
      } as any;
      
      formData.append('file', fileForUpload);
      
      // Use React Native's fetch with FormData - this is the correct approach
      const uploadResponse = await fetch(publicUrl, {
        method: 'PUT',
        headers: {
          'Authorization': authorization,
          'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
          'x-amz-date': date,
          'Content-Type': file.type,
        },
        body: fileForUpload, // Pass the file object directly
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('R2 upload failed:', {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          error: errorText
        });
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
      }
      
      console.log('R2 upload successful:', publicUrl);
      
      return {
        key: key,
        url: publicUrl,
        filename: file.name,
        size: file.size || 0,
        contentType: file.type,
      };
    } catch (error) {
      console.error('R2 Upload Error:', error);
      throw new Error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }



  async deleteFile(key: string): Promise<boolean> {
    if (!this.config) {
      throw new Error('Cloudflare R2 is not configured');
    }

    try {
      const deleteUrl = `https://${this.config.bucketName}.${this.config.endpoint.replace('https://', '')}/${key}`;
      
      // Create AWS v4 signature for DELETE
      const awsTimestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
      const { authorization, date } = await this.createAwsSignature('DELETE', key, '', awsTimestamp);
      
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': authorization,
          'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
          'x-amz-date': date,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('R2 delete failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Delete failed: ${response.status} ${response.statusText}`);
      }

      console.log('R2 delete successful:', key);
      return true;
    } catch (error) {
      console.error('R2 Delete Error:', error);
      throw new Error(`Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFileUrl(key: string): Promise<string> {
    if (!this.config) {
      throw new Error('R2 not configured');
    }
    
    // Generate public URL for the file
    return `https://${this.config.bucketName}.${this.config.endpoint.replace('https://', '')}/${key}`;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.config) {
      throw new Error('R2 not configured');
    }

    try {
      // Create presigned URL for GET request
      const now = new Date();
      const expiryDate = new Date(now.getTime() + expiresIn * 1000);
      const awsTimestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
      const date = now.toISOString().split('T')[0].replace(/-/g, '');
      
      const region = 'auto';
      const service = 's3';
      const algorithm = 'AWS4-HMAC-SHA256';
      
      // Clean the endpoint to get the hostname
      const hostname = this.config.endpoint.replace('https://', '').replace('http://', '');
      const host = `${this.config.bucketName}.${hostname}`;
      
      // Create canonical request
      const canonicalUri = encodeURI(`/${key}`).replace(/\+/g, '%20');
      
      // Query parameters for presigned URL
      const credentialScope = `${date}/${region}/${service}/aws4_request`;
      const credential = `${this.config.accessKeyId}/${credentialScope}`;
      
      const queryParams = new URLSearchParams({
        'X-Amz-Algorithm': algorithm,
        'X-Amz-Credential': credential,
        'X-Amz-Date': awsTimestamp,
        'X-Amz-Expires': expiresIn.toString(),
        'X-Amz-SignedHeaders': 'host',
      });
      
      const canonicalQueryString = queryParams.toString();
      
      const canonicalHeaders = `host:${host}\n`;
      const signedHeaders = 'host';
      const payloadHash = 'UNSIGNED-PAYLOAD';
      
      const canonicalRequest = [
        'GET',
        canonicalUri,
        canonicalQueryString,
        canonicalHeaders,
        signedHeaders,
        payloadHash
      ].join('\n');
      
      // Create string to sign
      const stringToSign = [
        algorithm,
        awsTimestamp,
        credentialScope,
        CryptoJS.SHA256(canonicalRequest).toString()
      ].join('\n');
      
      // Calculate signature
      const kDate = CryptoJS.HmacSHA256(date, `AWS4${this.config.secretAccessKey}`);
      const kRegion = CryptoJS.HmacSHA256(region, kDate);
      const kService = CryptoJS.HmacSHA256(service, kRegion);
      const kSigning = CryptoJS.HmacSHA256('aws4_request', kService);
      const signature = CryptoJS.HmacSHA256(stringToSign, kSigning).toString();
      
      // Add signature to query parameters
      queryParams.set('X-Amz-Signature', signature);
      
      const presignedUrl = `https://${host}${canonicalUri}?${queryParams.toString()}`;
      
      console.log('Generated presigned URL for:', key);
      return presignedUrl;
      
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      // Fallback to public URL
      return `https://${this.config.bucketName}.${this.config.endpoint.replace('https://', '')}/${key}`;
    }
  }

  // Helper method to validate file types
  isValidFileType(contentType: string, allowedTypes: string[]): boolean {
    return allowedTypes.some(type => contentType.startsWith(type));
  }

  // Helper method to validate file size
  isValidFileSize(size: number, maxSizeMB: number): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return size <= maxSizeBytes;
  }

  // Check if R2 is properly configured
  isConfigured(): boolean {
    return !!(this.config && 
             this.config.bucketName && 
             this.config.accessKeyId && 
             this.config.secretAccessKey && 
             this.config.endpoint);
  }

  // Get configuration status
  getStatus(): { configured: boolean; bucket?: string; endpoint?: string; error?: string } {
    if (!this.config) {
      return { 
        configured: false, 
        error: 'R2 configuration not found. Please check your environment variables.' 
      };
    }

    const missing = [];
    if (!this.config.bucketName) missing.push('EXPO_PUBLIC_R2_BUCKET_NAME');
    if (!this.config.accessKeyId) missing.push('EXPO_PUBLIC_R2_ACCESS_KEY_ID');
    if (!this.config.secretAccessKey) missing.push('EXPO_PUBLIC_R2_SECRET_ACCESS_KEY');
    if (!this.config.endpoint) missing.push('EXPO_PUBLIC_R2_ENDPOINT');

    if (missing.length > 0) {
      return {
        configured: false,
        error: `Missing environment variables: ${missing.join(', ')}`
      };
    }

    return {
      configured: true,
      bucket: this.config.bucketName,
      endpoint: this.config.endpoint,
    };
  }
}

export const r2Service = new R2Service();
