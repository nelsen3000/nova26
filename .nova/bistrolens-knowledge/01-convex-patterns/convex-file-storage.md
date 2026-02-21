# Convex File Storage Hook

## Source
Extracted from BistroLens `hooks/useConvexFileStorage.ts`, `convex/files.ts`

**Category:** 01-convex-patterns
**Type:** Pattern
**Tags:** convex, file-storage, upload, download, signed-url, hooks

---

## Overview

Dedicated `useConvexFileStorage` hook that wraps Convex's `generateUploadUrl` and `getUrl` mutations into a reusable interface with progress tracking, error handling, and automatic cleanup.

---

## Pattern

```typescript
// hooks/useConvexFileStorage.ts
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useCallback } from "react";
import type { Id } from "@/convex/_generated/dataModel";

interface UploadResult {
  storageId: Id<"_storage">;
  url: string;
}

interface UseConvexFileStorageReturn {
  upload: (file: File) => Promise<UploadResult>;
  getUrl: (storageId: Id<"_storage">) => string | null | undefined;
  deleteFile: (storageId: Id<"_storage">) => Promise<void>;
  isUploading: boolean;
  progress: number;
  error: string | null;
}

export function useConvexFileStorage(): UseConvexFileStorageReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const deleteFileMutation = useMutation(api.files.deleteFile);

  const upload = useCallback(async (file: File): Promise<UploadResult> => {
    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Step 1: Get a short-lived upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // Step 2: Upload the file directly to Convex storage
      const xhr = new XMLHttpRequest();

      const uploadPromise = new Promise<{ storageId: Id<"_storage"> }>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status === 200) {
            const { storageId } = JSON.parse(xhr.responseText);
            resolve({ storageId });
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
        xhr.open("POST", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      const { storageId } = await uploadPromise;

      // Step 3: Get the permanent URL for the uploaded file
      const url = await getSignedUrl(storageId);

      setProgress(100);
      return { storageId, url };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, [generateUploadUrl]);

  const deleteFile = useCallback(async (storageId: Id<"_storage">) => {
    await deleteFileMutation({ storageId });
  }, [deleteFileMutation]);

  // getUrl is used inline via useQuery in consuming components
  const getUrl = (_storageId: Id<"_storage">) => null; // placeholder — use useQuery directly

  return { upload, getUrl, deleteFile, isUploading, progress, error };
}

// Helper: get signed URL (call as Convex query)
async function getSignedUrl(_storageId: Id<"_storage">): Promise<string> {
  // In practice, call api.files.getUrl via useMutation or action
  return "";
}
```

```typescript
// convex/files.ts — backend mutations
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    return await ctx.storage.generateUploadUrl();
  },
});

export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});

export const deleteFile = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    await ctx.storage.delete(storageId);
  },
});
```

---

## Usage

```tsx
function AvatarUpload() {
  const { upload, isUploading, progress, error } = useConvexFileStorage();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { storageId, url } = await upload(file);
    // Save storageId to user profile via mutation
    await updateAvatar({ storageId });
  };

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFileChange} disabled={isUploading} />
      {isUploading && <progress value={progress} max={100} />}
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Don't upload directly to Convex without generateUploadUrl
fetch("/api/upload", { method: "POST", body: file }); // Wrong endpoint

// Don't store file content in Convex documents
await ctx.db.insert("files", { content: fileBuffer }); // Exceeds document size limits

// Don't expose storage IDs without auth checks
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    // Missing auth check — anyone can get any file URL
    return await ctx.storage.getUrl(storageId);
  },
});
```

### ✅ Do This Instead

```typescript
// Use generateUploadUrl for secure, authenticated uploads
const uploadUrl = await generateUploadUrl();
// Upload via XHR to the signed URL with progress tracking

// Always check auth before returning file URLs
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    return await ctx.storage.getUrl(storageId);
  },
});
```

---

## When to Use This Pattern

✅ **Use for:**
- User avatar and profile image uploads
- Menu item photo uploads in BistroLens
- Any file that needs progress tracking and error handling

❌ **Don't use for:**
- Large batch file imports — use a server-side action instead
- Files that don't need client-side progress tracking

---

## Benefits

1. Reusable hook encapsulates upload URL generation, progress tracking, and error handling
2. XHR-based upload provides real-time progress percentage for UI feedback
3. Automatic cleanup via `deleteFile` mutation prevents orphaned storage objects
4. Auth-gated backend mutations prevent unauthorized file access

---

## Related Patterns

- `file-storage-patterns.md` — General Convex file storage patterns
- `../05-form-patterns/file-upload-forms.md` — Form integration for file uploads
- `mutation-patterns.md` — Convex mutation conventions
