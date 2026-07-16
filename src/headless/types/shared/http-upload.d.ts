/**
 * @typedef {Object} UploadedFile
 * @property {string} url - The public GET URL of the uploaded file.
 * @property {string} name - The original filename.
 * @property {string} type - The file's MIME type.
 * @property {number} size - The file's size in bytes.
 */
/**
 * @typedef {Object} UploadService
 * @property {string} slot_request_url - The upload component's JID (slot-request target).
 * @property {number} max_file_size - Max allowed size in bytes (Infinity if unadvertised).
 */
/**
 * Discover the HTTP-Upload service (XEP-0363 § 3) advertised by `domain`.
 * @param {string} [domain] - Defaults to our own server's domain.
 * @returns {Promise<UploadService|null>} `null` when the server offers no upload service.
 */
export function getUploadService(domain?: string): Promise<UploadService | null>;
/**
 * Upload `file` via XEP-0363 and resolve to its public URL plus metadata.
 * @param {File} file
 * @param {object} [opts]
 * @param {string} [opts.domain] - Upload service host (defaults to our own domain).
 * @param {(fraction: number) => void} [opts.onProgress] - Upload progress (0..1).
 * @returns {Promise<UploadedFile>}
 * @throws when no service is available, the file is too large, or the PUT fails.
 */
export function uploadFile(file: File, { domain, onProgress }?: {
    domain?: string;
    onProgress?: (fraction: number) => void;
}): Promise<UploadedFile>;
export type UploadedFile = {
    /**
     * - The public GET URL of the uploaded file.
     */
    url: string;
    /**
     * - The original filename.
     */
    name: string;
    /**
     * - The file's MIME type.
     */
    type: string;
    /**
     * - The file's size in bytes.
     */
    size: number;
};
export type UploadService = {
    /**
     * - The upload component's JID (slot-request target).
     */
    slot_request_url: string;
    /**
     * - Max allowed size in bytes (Infinity if unadvertised).
     */
    max_file_size: number;
};
//# sourceMappingURL=http-upload.d.ts.map