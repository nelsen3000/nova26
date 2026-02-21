# File Upload Forms

## Source
Extracted from BistroLens:
- `components/RecipeScannerModal.tsx`
- `components/PantryScannerModal.tsx`
- `components/SettingsModal.tsx`
- `components/MealPrepPro.tsx`

---

## Pattern: Hidden File Input with Custom Trigger

File upload forms in BistroLens use a hidden `<input type="file">` element controlled by a ref, triggered by custom-styled buttons. This provides full control over the upload UI while maintaining native file picker functionality.

---

## Core Implementation

### Basic File Upload with Ref

```typescript
import React, { useRef } from 'react';

const FileUploadComponent: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    const imageData = event.target.result as string;
                    // Process the file data
                    console.log('File loaded:', imageData);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

    return (
        <>
            <button 
                onClick={triggerFileUpload}
                className="p-4 bg-brand-primary text-white rounded-full"
            >
                Upload Image
            </button>
            
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileUpload} 
            />
        </>
    );
};
```

---

## Advanced Pattern: Camera + Gallery Upload

### Dual Input Options (Camera & Gallery)

```typescript
import React, { useRef, useState } from 'react';
import { CameraIcon, ImageFileIcon } from './Icons';

interface ImageUploadModalProps {
    onImageSelected: (imageData: string) => void;
}

const ImageUploadModal: React.FC<ImageUploadModalProps> = ({ onImageSelected }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [mode, setMode] = useState<'camera' | 'upload'>('camera');

    // Camera capture logic
    const captureImage = () => {
        const video = videoRef.current;
        if (video) {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg');
            onImageSelected(dataUrl);
        }
    };

    // File upload handler
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    onImageSelected(event.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="relative h-full w-full">
            {mode === 'camera' && (
                <>
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="w-full h-full object-cover"
                    />
                    
                    {/* Bottom Actions */}
                    <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-8 z-20">
                        <button 
                            onClick={triggerFileUpload} 
                            className="p-4 bg-white/20 rounded-full backdrop-blur-md hover:bg-white/30 transition-all"
                            title="Upload from Gallery"
                        >
                            <ImageFileIcon className="w-6 h-6 text-white" />
                        </button>
                        
                        <button 
                            onClick={captureImage} 
                            className="p-5 bg-white/20 rounded-full border-4 border-white/80 backdrop-blur-md hover:bg-white/40 transition-all shadow-lg" 
                            aria-label="Capture image"
                        >
                            <CameraIcon className="w-8 h-8 text-white" />
                        </button>
                        
                        {/* Spacer for layout balance */}
                        <div className="w-14"></div>
                    </div>
                </>
            )}

            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileUpload} 
            />
        </div>
    );
};
```

---

## Pattern: Programmatic File Input Creation

### Dynamic File Input (No JSX)

```typescript
// Used in MealPrepPro for on-demand photo capture
const handlePhotoCapture = async () => {
    // Create input element programmatically
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Use rear camera on mobile
    
    input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const imageData = event.target?.result as string;
                try {
                    // Process the image
                    await processImage(imageData);
                } catch (error) {
                    console.error('Image processing failed:', error);
                }
            };
            reader.readAsDataURL(file);
        }
    };
    
    // Trigger file picker
    input.click();
};
```

---

## Pattern: JSON File Import/Export

### Data Backup & Restore

```typescript
import React, { useRef } from 'react';
import { DownloadIcon, TruckIcon } from './Icons';

const DataManagement: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Export data as JSON
    const handleExportData = () => {
        const exportData: Record<string, any> = {};
        
        // Collect data from localStorage
        const keys = [
            'bistroLensSettings',
            'bistroLensFavorites',
            'bistroLensCollections'
        ];
        
        keys.forEach(key => {
            const val = localStorage.getItem(key);
            if (val) exportData[key] = JSON.parse(val);
        });
        
        // Create and download file
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // Import data from JSON file
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                
                // Validate data structure
                if (!data.bistroLensSettings) {
                    throw new Error("Invalid backup file");
                }
                
                // Confirm before overwriting
                if (confirm('This will overwrite your current data. Continue?')) {
                    Object.keys(data).forEach(key => {
                        localStorage.setItem(key, JSON.stringify(data[key]));
                    });
                    
                    alert('Data restored successfully! Reloading...');
                    setTimeout(() => window.location.reload(), 1500);
                }
            } catch (err) {
                alert("Import failed. Invalid file format.");
            }
        };
        
        reader.readAsText(file);
        
        // Reset input value to allow re-uploading same file
        event.target.value = '';
    };

    return (
        <div className="flex gap-2">
            <button 
                onClick={handleExportData}
                className="px-3 py-2 bg-white border border-gray-300 rounded-full text-xs font-bold uppercase flex items-center gap-1"
            >
                <DownloadIcon className="w-3 h-3" /> BACKUP DATA
            </button>
            
            <button 
                onClick={handleImportClick}
                className="px-3 py-2 bg-white border border-gray-300 rounded-full text-xs font-bold uppercase flex items-center gap-1"
            >
                <TruckIcon className="w-3 h-3" /> RESTORE DATA
            </button>
            
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".json" 
                onChange={handleFileChange} 
            />
        </div>
    );
};
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// BAD: Visible file input with default styling
<input 
    type="file" 
    accept="image/*"
    className="border p-2"
    onChange={handleUpload}
/>

// BAD: No file type validation
const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Missing: file type check, size validation
    processFile(file);
};

// BAD: Not resetting input value
<input 
    type="file" 
    ref={fileInputRef}
    onChange={handleUpload}
    // Missing: value reset after upload
/>

// BAD: No error handling
reader.onload = (event) => {
    const data = JSON.parse(event.target?.result as string);
    // Missing: try-catch, validation
};
```

### ✅ Do This Instead

```typescript
// GOOD: Hidden input with custom trigger
<button onClick={() => fileInputRef.current?.click()}>
    Upload Image
</button>
<input 
    type="file" 
    ref={fileInputRef}
    className="hidden"
    accept="image/*"
    onChange={handleUpload}
/>

// GOOD: Validate file type and size
const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }
    
    // Validate file size (e.g., 5MB limit)
    if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
    }
    
    processFile(file);
};

// GOOD: Reset input value after processing
const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        processFile(file);
    }
    // Reset to allow re-uploading same file
    event.target.value = '';
};

// GOOD: Comprehensive error handling
reader.onload = (e) => {
    try {
        const data = JSON.parse(e.target?.result as string);
        
        // Validate structure
        if (!isValidData(data)) {
            throw new Error("Invalid data format");
        }
        
        processData(data);
    } catch (err) {
        console.error('File processing error:', err);
        alert('Failed to process file');
    }
};
```

---

## When to Use This Pattern

✅ **Use for:**
- Image uploads with custom UI styling
- Camera capture + gallery upload dual functionality
- JSON data import/export features
- Profile photo uploads
- Document/file attachments
- Any scenario requiring custom upload button styling

❌ **Don't use for:**
- Simple forms where default file input is acceptable
- Drag-and-drop file uploads (use different pattern)
- Multiple file uploads (requires array handling)
- Large file uploads (consider chunked upload pattern)

---

## Benefits

1. **Full UI Control**: Style upload buttons to match your design system
2. **Mobile-Friendly**: Works seamlessly with mobile camera and gallery
3. **Accessibility**: Maintain native file picker accessibility
4. **Type Safety**: TypeScript types for file handling
5. **Flexible**: Supports images, JSON, and any file type
6. **User Experience**: Hide ugly default file inputs
7. **Progressive Enhancement**: Falls back to native input if JS fails

---

## Key Implementation Details

### File Input Attributes

```typescript
<input 
    type="file"
    ref={fileInputRef}
    className="hidden"           // Hide the input
    accept="image/*"             // Restrict file types
    capture="environment"        // Use rear camera on mobile
    onChange={handleFileUpload}  // Handle file selection
/>
```

### Accept Attribute Values

- `image/*` - All image types
- `image/jpeg,image/png` - Specific image types
- `.json` - JSON files only
- `video/*` - All video types
- `audio/*` - All audio types
- `.pdf,.doc,.docx` - Specific document types

### FileReader API

```typescript
const reader = new FileReader();

// For images (base64 data URL)
reader.readAsDataURL(file);

// For text files (JSON, CSV, etc.)
reader.readAsText(file);

// For binary files
reader.readAsArrayBuffer(file);

reader.onload = (event) => {
    const result = event.target?.result;
    // Process the file content
};

reader.onerror = (error) => {
    console.error('File read error:', error);
};
```

---

## Related Patterns

- See `form-validation.md` for file validation patterns
- See `error-states.md` for upload error handling
- See `loading-states.md` for upload progress indicators
- See `modal-dialog.md` for upload modal implementations

---

*Extracted: 2026-02-18*
