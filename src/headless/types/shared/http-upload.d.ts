/**
 * Discover the HTTP-Upload service (XEP-0363 § 3) advertised by `domain`.
 * @param {string} [domain] - Defaults to our own server's domain.
 * @returns {Promise<import('./types').UploadService|null>} `null` when the server offers
 *      no upload service.
 */
export function getUploadService(domain?: string): Promise<import("./types").UploadService | null>;
/**
 * Request an upload slot for `file` (XEP-0363 § 4).
 * @param {File} file
 * @param {string} slot_request_url
 * @returns {Promise<import('./types').UploadSlot>}
 * @throws The IQ error on failure, or an `Error` with `code === NO_SLOT` if the response
 *      carried no slot.
 */
export function requestSlot(file: File, slot_request_url: string): Promise<import("./types").UploadSlot>;
/**
 * PUT `file` to the slot's put URL (XEP-0363 § 5).
 * @param {File} file
 * @param {import('./types').UploadTarget} slot
 * @param {(fraction: number) => void} [onProgress]
 * @returns {Promise<void>}
 * @throws An `Error` carrying the `status` and `responseText`, so a caller can quote the
 *      server's own complaint back to the user.
 */
export function putFile(file: File, slot: import("./types").UploadTarget, onProgress?: (fraction: number) => void): Promise<void>;
/**
 * Upload `file` via XEP-0363 and resolve to its public URL plus metadata.
 * @param {File} file
 * @param {object} [opts]
 * @param {string} [opts.domain] - Upload service host (defaults to our own domain).
 * @param {(fraction: number) => void} [opts.onProgress] - Upload progress (0..1).
 * @returns {Promise<import('./types').UploadedFile>}
 * @throws when no service is available, the file is too large, or the PUT fails.
 */
export function uploadFile(file: File, { domain, onProgress }?: {
    domain?: string;
    onProgress?: (fraction: number) => void;
}): Promise<import("./types").UploadedFile>;
/**
 * The `code` on the error {@link requestSlot} throws when the service answered, but with
 * no slot in it. Distinguishable from the IQ itself failing, which the chat upload path
 * reports differently.
 */
export const NO_SLOT: "no-slot";
//# sourceMappingURL=http-upload.d.ts.map