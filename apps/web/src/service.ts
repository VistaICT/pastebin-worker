/**
 * Service layer barrel export.
 *
 * The service module is organized into focused sub-modules for easier agent editing:
 * - `auth.ts` - Authentication (login, logout, user info)
 * - `secrets.ts` - Secret CRUD operations
 * - `files-api.ts` - File API utilities
 * - `files-upload.ts` - Encrypted file upload
 * - `files-download.ts` - Encrypted file download with streaming
 * - `types.ts` - Shared types and interfaces
 * - `utils.ts` - Common utilities (progress reporting, error handling)
 */

export * from './service/index';
