# File Upload Form Patterns

## Source
Extracted from BistroLens `components/RecipeScannerModal.tsx`, `components/PantryScannerModal.tsx`, `components/SettingsModal.tsx`

---

## Pattern: File Upload with Preview and Processing

Comprehensive file upload patterns including file selection, FileReader API usage, image preview, and processing workflows.

---

## Basic File Upload Input

### Code Example

```typescript
import { useRef, useState } from 'react';

const FileUploadComponent: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      playClickSound();
      setSelectedFile(file);
      
      // Read file as Data URL for preview
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileUpload}
      />
      
      {/* Trigger button */}
      <button
        onClick={triggerFileUpload}
        className="px-4 py-2 bg-brand-primary text-white rounded-lg"
      >
        Upload Image
      </button>
      
      {/* Preview */}
      {imageUrl && (
        <img src={imageUrl} alt="Preview" className="mt-4 max-w-md rounded-lg" />
      )}
    </div>
  );
};
```

---

## FileReader API Patterns

### Reading as Data URL (for images)

```typescript
const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  const reader = new FileReader();
  
  reader.onload = (event) => {
    if (event.target?.result) {
      const dataUrl = event.target.result as string;
      setImageUrl(dataUrl);
      // dataUrl format: "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
    }
  };
  
  reader.onerror = (error) => {
    console.error('FileReader error:', error);
    setError('Failed to read file');
  };
  
  reader.readAsDataURL(file);
};
```

### Reading as Text (for JSON/CSV)

```typescript
const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;
  
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const text = e.target?.result as string;
      const data = JSON.parse(text);
      // Process JSON data
      importData(data);
    } catch (error) {
      setError('Invalid JSON file');
    }
  };
  
  reader.readAsText(file);
};
```

### Reading as ArrayBuffer (for binary files)

```typescript
const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  const reader = new FileReader();
  
  reader.onload = (event) => {
    const arrayBuffer = event.target?.result as ArrayBuffer;
    // Process binary data
    processBinaryFile(arrayBuffer);
  };
  
  reader.readAsArrayBuffer(file);
};
```

---

## Image Upload with Cropping

### Code Example

```typescript
import { useState } from 'react';
import ImageCropper from './ImageCropper';

type UploadState = 'selection' | 'cropping' | 'preview' | 'uploading';

const ImageUploadWithCrop: React.FC = () => {
  const [uploadState, setUploadState] = useState<UploadState>('selection');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      playClickSound();
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageUrl(event.target.result as string);
          setUploadState('cropping');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (cropped: string) => {
    setCroppedImageUrl(cropped);
    setUploadState('preview');
  };

  const handleUpload = async () => {
    setUploadState('uploading');
    try {
      await uploadImage(croppedImageUrl);
      playSuccessSound();
    } catch (error) {
      setError('Upload failed');
    }
  };

  return (
    <div>
      {uploadState === 'selection' && (
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
        />
      )}
      
      {uploadState === 'cropping' && imageUrl && (
        <ImageCropper
          imageUrl={imageUrl}
          onCropComplete={handleCropComplete}
        />
      )}
      
      {uploadState === 'preview' && croppedImageUrl && (
        <div>
          <img src={croppedImageUrl} alt="Preview" />
          <button onClick={handleUpload}>Upload</button>
        </div>
      )}
      
      {uploadState === 'uploading' && (
        <LoadingSpinner message="Uploading..." />
      )}
    </div>
  );
};
```

---

## Camera Capture Alternative

### Code Example

```typescript
import { useRef, useCallback } from 'react';

const CameraCapture: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera. Please allow permissions or try uploading a photo.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const captureImage = () => {
    playClickSound();
    const video = videoRef.current;
    if (video) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setImageUrl(dataUrl);
      stopCamera(); // Stop camera to save battery
    }
  };

  return (
    <div>
      <video ref={videoRef} autoPlay playsInline className="w-full" />
      <button onClick={captureImage}>Capture</button>
      <button onClick={triggerFileUpload}>Or Upload Photo</button>
    </div>
  );
};
```

---

## File Type Validation

### Code Example

```typescript
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  // Validate file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    setError('Please upload a valid image file (JPEG, PNG, WebP, or GIF)');
    return;
  }
  
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    setError('File size must be less than 5MB');
    return;
  }
  
  // File is valid, proceed with upload
  const reader = new FileReader();
  reader.onload = (event) => {
    if (event.target?.result) {
      setImageUrl(event.target.result as string);
    }
  };
  reader.readAsDataURL(file);
};

// In JSX
<input
  type="file"
  accept="image/jpeg,image/png,image/webp,image/gif"
  onChange={handleFileUpload}
/>
```

---

## Multiple File Upload

### Code Example

```typescript
const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
const [previews, setPreviews] = useState<string[]>([]);

const handleMultipleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  
  if (files.length === 0) return;
  
  // Validate each file
  const validFiles = files.filter(file => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      console.warn(`Skipping invalid file: ${file.name}`);
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      console.warn(`Skipping large file: ${file.name}`);
      return false;
    }
    return true;
  });
  
  setSelectedFiles(validFiles);
  
  // Generate previews
  const previewPromises = validFiles.map(file => {
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });
  });
  
  Promise.all(previewPromises).then(setPreviews);
};

// In JSX
<input
  type="file"
  multiple
  accept="image/*"
  onChange={handleMultipleFileUpload}
/>

{/* Preview grid */}
<div className="grid grid-cols-3 gap-4 mt-4">
  {previews.map((preview, index) => (
    <div key={index} className="relative">
      <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-32 object-cover rounded-lg" />
      <button
        onClick={() => removeFile(index)}
        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  ))}
</div>
```

---

## Drag and Drop Upload

### Code Example

```typescript
import { useState, useCallback } from 'react';

const DragDropUpload: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      processFiles(imageFiles);
    }
  }, []);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center
        ${isDragging ? 'border-brand-primary bg-brand-primary/10' : 'border-gray-300'}
      `}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileUpload}
      />
      
      <div className="space-y-4">
        <UploadIcon className="w-12 h-12 mx-auto text-gray-400" />
        <div>
          <p className="text-lg font-medium">
            {isDragging ? 'Drop files here' : 'Drag and drop files here'}
          </p>
          <p className="text-sm text-gray-500 mt-1">or</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 px-4 py-2 bg-brand-primary text-white rounded-lg"
          >
            Browse Files
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## Upload Progress Indicator

### Code Example

```typescript
const [uploadProgress, setUploadProgress] = useState(0);
const [isUploading, setIsUploading] = useState(false);

const uploadFile = async (file: File) => {
  setIsUploading(true);
  setUploadProgress(0);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        setUploadProgress(percentComplete);
      }
    });

    // Handle completion
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        playSuccessSound();
        setUploadProgress(100);
      } else {
        throw new Error('Upload failed');
      }
    });

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  } catch (error) {
    playErrorSound();
    setError('Upload failed');
  } finally {
    setIsUploading(false);
  }
};

// Progress bar UI
{isUploading && (
  <div className="mt-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-medium">Uploading...</span>
      <span className="text-sm text-gray-500">{Math.round(uploadProgress)}%</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className="bg-brand-primary h-2 rounded-full transition-all duration-300"
        style={{ width: `${uploadProgress}%` }}
      />
    </div>
  </div>
)}
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// No file validation
const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  uploadFile(file); // Could be 100MB video file!
};

// Blocking UI without feedback
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  await uploadFile(file); // User has no idea what's happening
};

// Not handling errors
reader.onload = (e) => {
  const data = JSON.parse(e.target?.result as string);
  // What if JSON is invalid? App crashes
};

// Memory leaks with large files
const reader = new FileReader();
reader.readAsDataURL(largeFile); // Loads entire file into memory
```

### ✅ Do This Instead

```typescript
// Validate before processing
const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  // Validate type
  if (!ALLOWED_TYPES.includes(file.type)) {
    setError('Invalid file type');
    return;
  }
  
  // Validate size
  if (file.size > MAX_SIZE) {
    setError('File too large');
    return;
  }
  
  uploadFile(file);
};

// Show progress
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  setIsUploading(true);
  setProgress(0);
  
  try {
    await uploadFileWithProgress(file, setProgress);
    playSuccessSound();
  } catch (error) {
    setError('Upload failed');
  } finally {
    setIsUploading(false);
  }
};

// Handle errors gracefully
reader.onload = (e) => {
  try {
    const data = JSON.parse(e.target?.result as string);
    processData(data);
  } catch (error) {
    setError('Invalid JSON file');
  }
};

reader.onerror = () => {
  setError('Failed to read file');
};

// Use appropriate read method for file size
if (file.size < 1024 * 1024) { // < 1MB
  reader.readAsDataURL(file);
} else {
  // Use chunked upload for large files
  uploadInChunks(file);
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Profile picture uploads
- Document uploads (PDFs, images)
- CSV/JSON data imports
- Image galleries
- Recipe/menu scanning
- Attachment uploads

❌ **Don't use for:**
- Very large files (use chunked upload instead)
- Video uploads (use specialized video upload libraries)
- Real-time file streaming

---

## Benefits

1. **User Flexibility** - Support both file selection and camera capture
2. **Immediate Feedback** - Preview images before upload
3. **Validation** - Catch invalid files before processing
4. **Better UX** - Progress indicators show upload status
5. **Error Handling** - Clear error messages guide users
6. **Mobile Friendly** - Camera integration for mobile devices
7. **Accessibility** - Hidden input with accessible trigger button

---

## Related Patterns

- See `form-submission.md` for handling upload completion
- See `../04-ui-components/loading-states.md` for upload progress UI
- See `../07-error-handling/error-messages.md` for upload error handling
- See `../14-performance/image-optimization.md` for processing uploaded images

---

*Extracted: 2026-02-18*
