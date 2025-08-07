import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { r2Service, type FileToUpload } from '../lib/r2-service';

// File metadata interface for uploaded files
interface ProductFile {
  key: string;
  url: string;
  filename: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
}

interface FileUploadProps {
  onUploadComplete: (files: ProductFile[]) => void;
  onUploadError: (error: string) => void;
  fileType: 'image' | 'document';
  allowMultiple?: boolean;
  maxFiles?: number;
  folder?: string;
}

interface FileItemProps {
  file: ProductFile;
  onDelete: (key: string) => void;
}

export interface FileUploadRef {
  handleUpload: () => Promise<void>;
}

export const FileUpload = forwardRef<FileUploadRef, FileUploadProps>(({ 
  onUploadComplete, 
  onUploadError, 
  fileType, 
  allowMultiple = false, 
  maxFiles = 1,
  folder = 'uploads'
}, ref) => {
  const [isUploading, setIsUploading] = useState(false);

  // Expose handleUpload method to parent component
  useImperativeHandle(ref, () => ({
    handleUpload: async () => {
      await handleUpload();
    }
  }));

  const requestPermissions = async () => {
    if (fileType === 'image') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
        return false;
      }
    }
    return true;
  };

  const pickImages = async (): Promise<FileToUpload[]> => {
    // Use the minimal working configuration
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: allowMultiple,
      quality: 0.8,
      allowsEditing: !allowMultiple,
      aspect: allowMultiple ? undefined : [4, 3],
    });

    if (result.canceled) {
      return [];
    }

    return result.assets.map((asset: any) => ({
      uri: asset.uri,
      name: asset.fileName || `image_${Date.now()}.jpg`,
      type: 'image/jpeg',
      size: asset.fileSize,
    }));
  };

  const pickDocuments = async (): Promise<FileToUpload[]> => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      multiple: allowMultiple,
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return [];
    }

    return result.assets.map(asset => ({
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType || 'application/octet-stream',
      size: asset.size,
    }));
  };

  const validateFiles = (files: FileToUpload[]): { valid: FileToUpload[]; errors: string[] } => {
    const valid: FileToUpload[] = [];
    const errors: string[] = [];

    // Check file count
    if (files.length > maxFiles) {
      errors.push(`Maximum ${maxFiles} files allowed`);
      return { valid: [], errors };
    }

    for (const file of files) {
      // Check file size (10MB limit)
      if (file.size && !r2Service.isValidFileSize(file.size, 10)) {
        errors.push(`${file.name} is too large (max 10MB)`);
        continue;
      }

      // Check file type
      const allowedTypes = fileType === 'image' 
        ? ['image/jpeg', 'image/png'] 
        : ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      
      if (!r2Service.isValidFileType(file.type, allowedTypes)) {
        errors.push(`${file.name} has invalid file type`);
        continue;
      }

      valid.push(file);
    }

    return { valid, errors };
  };

  const handleUpload = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setIsUploading(true);
    
    try {
      // Pick files based on type
      const pickedFiles = fileType === 'image' 
        ? await pickImages()
        : await pickDocuments();

      if (pickedFiles.length === 0) {
        setIsUploading(false);
        return;
      }

      // Validate files
      const { valid: validFiles, errors } = validateFiles(pickedFiles);
      
      if (errors.length > 0) {
        Alert.alert('File Validation Error', errors.join('\n'));
        if (validFiles.length === 0) {
          setIsUploading(false);
          return;
        }
      }

      // Check R2 configuration status
      const r2Status = r2Service.getStatus();
      if (!r2Status.configured) {
        Alert.alert(
          'R2 Not Configured', 
          r2Status.error || 'Cloudflare R2 is not properly configured. Please check your environment variables.',
          [{ text: 'OK' }]
        );
        setIsUploading(false);
        return;
      }

      // Upload files
      const uploadPromises = validFiles.map(async (file, index) => {
        try {
          console.log(`Uploading file ${index + 1}/${validFiles.length}: ${file.name}`);
          const result = await r2Service.uploadFile(file, folder);
          console.log(`Upload successful: ${result.url}`);
          return result;
        } catch (error) {
          console.error(`Upload failed for ${file.name}:`, error);
          throw error;
        }
      });

      const uploadResults = await Promise.all(uploadPromises);
      
      // Convert to ProductFile format
      const productFiles: ProductFile[] = uploadResults.map(result => ({
        key: result.key,
        url: result.url,
        filename: result.filename,
        size: result.size,
        contentType: result.contentType,
        uploadedAt: new Date(),
      }));

      onUploadComplete(productFiles);
      
      if (errors.length > 0) {
        Alert.alert('Upload Complete', `${productFiles.length} files uploaded successfully. ${errors.length} files were skipped due to validation errors.`);
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      onUploadError(errorMessage);
      Alert.alert('Upload Error', errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
      onPress={handleUpload}
      disabled={isUploading}
    >
      {isUploading ? (
        <ActivityIndicator size="small" color="#3b82f6" />
      ) : (
        <Feather 
          name={fileType === 'image' ? 'image' : 'file'} 
          size={24} 
          color="#3b82f6" 
        />
      )}
      <Text style={styles.uploadButtonText}>
        {isUploading 
          ? 'Uploading...' 
          : `Upload ${fileType === 'image' ? 'Images' : 'Documents'}`
        }
      </Text>
    </TouchableOpacity>
  );
});

export function FileItem({ file, onDelete }: FileItemProps) {
  const [imageError, setImageError] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Generate signed URL for images
  useEffect(() => {
    const isImage = file.contentType.startsWith('image/');
    if (isImage && !signedUrl && !isLoadingUrl) {
      setIsLoadingUrl(true);
      r2Service.getSignedUrl(file.key)
        .then(url => {
          console.log('Got signed URL for', file.key, ':', url);
          setSignedUrl(url);
        })
        .catch(error => {
          console.error('Failed to get signed URL:', error);
          setImageError(true);
        })
        .finally(() => {
          setIsLoadingUrl(false);
        });
    }
  }, [file.key, file.contentType, signedUrl, isLoadingUrl]);

  const handleDelete = () => {
    Alert.alert(
      'Delete File',
      'Are you sure you want to delete this file?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(file.key) },
      ]
    );
  };

  const renderFileIcon = () => {
    const isImage = file.contentType.startsWith('image/');
    
    if (isImage && !imageError && signedUrl) {
      return (
        <Image
          source={{ uri: signedUrl }}
          style={styles.imageThumbnail}
          onError={() => {
            console.error('Image failed to load:', signedUrl);
            setImageError(true);
          }}
          resizeMode="cover"
        />
      );
    }
    
    return (
      <View style={styles.fileIconContainer}>
        {isLoadingUrl ? (
          <ActivityIndicator size="small" color="#64748b" />
        ) : (
          <Feather 
            name={isImage ? 'image' : 'file'} 
            size={20} 
            color="#64748b" 
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.fileItem}>
      <View style={styles.fileInfo}>
        {renderFileIcon()}
        <View style={styles.fileDetails}>
          <Text style={styles.fileName}>{file.filename}</Text>
          <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
        <Feather name="trash-2" size={16} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 20,
    marginBottom: 16,
    backgroundColor: '#f8fafc',
  },
  uploadButtonDisabled: {
    opacity: 0.6,
    borderColor: '#94a3b8',
  },
  uploadButtonText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
    marginLeft: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileDetails: {
    marginLeft: 12,
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: '#64748b',
  },
  deleteButton: {
    padding: 8,
  },
  imageThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
