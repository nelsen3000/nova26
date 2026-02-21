# File Storage Patterns

## Source
Extracted from BistroLens `.kiro/steering/38-CONVEX-DATABASE-PATTERNS.md` (Section 6)

---

## Pattern: Convex File Storage

Convex provides built-in file storage with automatic CDN distribution. Files are stored in `_storage` and referenced by `storageId`.

---

## Upload Pattern

### Generate Upload URL (Step 1)

```typescript
// convex/files.ts
import { mutation } from "./_generated/server";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    // Auth check required
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    // Generate temporary upload URL (expires in 1 hour)
    return await ctx.storage.generateUploadUrl();
  },
});
```

### Client-Side Upload (Step 2)

```typescript
// components/FileUpload.tsx
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function FileUpload() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveFile = useMutation(api.files.saveFile);
  
  async function handleUpload(file: File) {
    // Step 1: Get upload URL
    const uploadUrl = await generateUploadUrl();
    
    // Step 2: Upload file to Convex storage
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    
    const { storageId } = await response.json();
    
    // Step 3: Save file reference in database
    await saveFile({
      storageId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });
  }
  
  return <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />;
}
```

### Save File Reference (Step 3)

```typescript
// convex/files.ts
import { v } from "convex/values";

export const saveFile = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    // Validate file size (10MB limit)
    if (args.fileSize > 10 * 1024 * 1024) {
      throw new Error("File too large (max 10MB)");
    }
    
    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(args.fileType)) {
      throw new Error("Invalid file type");
    }
    
    return await ctx.db.insert("files", {
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      userId: identity.subject,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
```

---

## Download Pattern

### Get File URL

```typescript
// convex/files.ts
export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    // Returns CDN URL (cached, fast)
    return await ctx.storage.getUrl(args.storageId);
  },
});
```

### Get File with Metadata

```typescript
export const getFile = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const file = await ctx.db.get(args.fileId);
    if (!file || file.userId !== identity.subject) {
      throw new Error("File not found or access denied");
    }
    
    // Get download URL
    const url = await ctx.storage.getUrl(file.storageId);
    
    return {
      ...file,
      url,
    };
  },
});
```

---

## Delete Pattern

### Soft Delete File Reference

```typescript
export const deleteFile = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const file = await ctx.db.get(args.fileId);
    if (!file || file.userId !== identity.subject) {
      throw new Error("File not found or access denied");
    }
    
    // Soft delete file reference
    await ctx.db.patch(args.fileId, {
      isDeleted: true,
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    // Note: Storage file remains (for recovery)
    // Hard delete with scheduled cleanup job
  },
});
```

### Hard Delete Storage File

```typescript
// Scheduled cleanup job (runs daily)
export const cleanupDeletedFiles = internalMutation({
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    const deletedFiles = await ctx.db
      .query("files")
      .filter((q) => 
        q.and(
          q.eq(q.field("isDeleted"), true),
          q.lt(q.field("deletedAt"), thirtyDaysAgo)
        )
      )
      .collect();
    
    for (const file of deletedFiles) {
      // Delete from storage
      await ctx.storage.delete(file.storageId);
      
      // Delete database record
      await ctx.db.delete(file._id);
    }
  },
});
```

---

## Schema Definition

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  files: defineTable({
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    userId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_storage_id", ["storageId"]),
});
```

---

## Anti-Patterns

### ❌ Don't Store Files in Database

```typescript
// ❌ BAD - Storing base64 in database
await ctx.db.insert("files", {
  fileData: base64String, // Bloats database
});

// ✅ GOOD - Use Convex storage
const storageId = await uploadToStorage(file);
await ctx.db.insert("files", {
  storageId, // Just reference
});
```

### ❌ Don't Skip Auth on Upload URL

```typescript
// ❌ BAD - Anyone can upload
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl(); // No auth!
  },
});

// ✅ GOOD - Require auth
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    return await ctx.storage.generateUploadUrl();
  },
});
```

### ❌ Don't Hard Delete Immediately

```typescript
// ❌ BAD - Immediate hard delete
await ctx.storage.delete(storageId);
await ctx.db.delete(fileId);

// ✅ GOOD - Soft delete with cleanup job
await ctx.db.patch(fileId, {
  isDeleted: true,
  deletedAt: Date.now(),
});
// Cleanup job runs later
```

---

## When to Use This Pattern

✅ **Use for:**
- User-uploaded images (profile pics, recipe photos)
- Generated content (AI images, PDFs)
- Temporary files (exports, reports)
- Media files (audio, video under 1GB)

❌ **Don't use for:**
- Large video files (>1GB) - use external CDN
- Streaming media - use dedicated service
- Public assets - use static hosting
- Frequently changing files - storage is immutable

---

## Benefits

1. **Automatic CDN** - Files served from edge locations
2. **Secure uploads** - Temporary URLs prevent abuse
3. **Type safety** - storageId is typed
4. **Simple API** - No S3 configuration needed
5. **Integrated** - Works seamlessly with Convex queries

---

## File Size Limits

| Tier | Max File Size | Total Storage |
|------|---------------|---------------|
| Free | 10 MB | 1 GB |
| Pro | 100 MB | 100 GB |
| Enterprise | 1 GB | Custom |

---

## Related Patterns

- See `mutation-patterns.md` for CRUD operations
- See `query-patterns.md` for fetching file lists
- See `error-handling.md` for upload error handling

---

*Extracted: 2026-02-18*
