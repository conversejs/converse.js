import Compress from 'client-compress';

export const MIMETYPES_MAP = {
    'aac': 'audio/aac',
    'abw': 'application/x-abiword',
    'arc': 'application/x-freearc',
    'avi': 'video/x-msvideo',
    'azw': 'application/vnd.amazon.ebook',
    'bin': 'application/octet-stream',
    'bmp': 'image/bmp',
    'bz': 'application/x-bzip',
    'bz2': 'application/x-bzip2',
    'cda': 'application/x-cdf',
    'csh': 'application/x-csh',
    'css': 'text/css',
    'csv': 'text/csv',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'eot': 'application/vnd.ms-fontobject',
    'epub': 'application/epub+zip',
    'gif': 'image/gif',
    'gz': 'application/gzip',
    'htm': 'text/html',
    'html': 'text/html',
    'ico': 'image/vnd.microsoft.icon',
    'ics': 'text/calendar',
    'jar': 'application/java-archive',
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'js': 'text/javascript',
    'json': 'application/json',
    'jsonld': 'application/ld+json',
    'm4a': 'audio/mp4',
    'mid': 'audio/midi',
    'midi': 'audio/midi',
    'mjs': 'text/javascript',
    'mp3': 'audio/mpeg',
    'mp4': 'video/mp4',
    'mpeg': 'video/mpeg',
    'mpkg': 'application/vnd.apple.installer+xml',
    'odp': 'application/vnd.oasis.opendocument.presentation',
    'ods': 'application/vnd.oasis.opendocument.spreadsheet',
    'odt': 'application/vnd.oasis.opendocument.text',
    'oga': 'audio/ogg',
    'ogv': 'video/ogg',
    'ogx': 'application/ogg',
    'opus': 'audio/opus',
    'otf': 'font/otf',
    'png': 'image/png',
    'pdf': 'application/pdf',
    'php': 'application/x-httpd-php',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'rar': 'application/vnd.rar',
    'rtf': 'application/rtf',
    'sh': 'application/x-sh',
    'svg': 'image/svg+xml',
    'swf': 'application/x-shockwave-flash',
    'tar': 'application/x-tar',
    'tif': 'image/tiff',
    'tiff': 'image/tiff',
    'ts': 'video/mp2t',
    'ttf': 'font/ttf',
    'txt': 'text/plain',
    'vsd': 'application/vnd.visio',
    'wav': 'audio/wav',
    'weba': 'audio/webm',
    'webm': 'video/webm',
    'webp': 'image/webp',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'xhtml': 'application/xhtml+xml',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xml': 'text/xml',
    'xul': 'application/vnd.mozilla.xul+xml',
    'zip': 'application/zip',
    '3gp': 'video/3gpp',
    '3g2': 'video/3gpp2',
    '7z': 'application/x-7z-compressed',
};

/**
 * Returns true if the passed in image file is a PNG image with transparency.
 * @param {File} image_file
 * @returns {Promise<boolean>}
 */
export async function isImageWithAlphaChannel(image_file) {
    if (image_file.type === MIMETYPES_MAP['png']) {
        const buff_reader = new FileReader();
        return await new Promise((resolve) => {
            buff_reader.onloadend = (e) => {
                const view = new DataView(/** @type {ArrayBuffer} */ (e.target.result));
                // Check for alpha channel in PNG
                if (view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) {
                    // https://www.w3.org/TR/png/#11IHDR
                    // The chunk exists at offset 8 +8 bytes (size, name) +8 (depth) & +9 (type)
                    const type = view.getUint8(8 + 8 + 9);
                    const greyscale_with_alpha = 4;
                    const color_with_alpha = 6;
                    resolve(type === greyscale_with_alpha || type === color_with_alpha);
                }
                resolve(false);
            };
            buff_reader.readAsArrayBuffer(image_file);
        });
    }
    return false;
}

/**
 * @param {File} file
 * @param {import('./types').CompressionOptions} options
 * @returns {Promise<Blob>}
 */
export async function compressImage(
    file,
    options = {
        targetSize: 0.1,
        quality: 0.75,
        maxWidth: 256,
        maxHeight: 256,
        maxUncompressedSize: 100, // In KB
    }
) {
    if (options.maxUncompressedSize && file.size > options.maxUncompressedSize * 1024) {
        delete options.maxUncompressedSize;
        const compress = new Compress(options);
        const conversions = await compress.compress([file]);
        const { photo } = conversions[0];
        return photo.data;
    }
    return file;
}
