/**
 * Returns true if the passed in image file is a PNG image with transparency.
 * @param {File} image_file
 * @returns {Promise<boolean>}
 */
export function isImageWithAlphaChannel(image_file: File): Promise<boolean>;
/**
 * @param {File} file
 * @param {import('./types').CompressionOptions} options
 * @returns {Promise<Blob>}
 */
export function compressImage(file: File, options?: import("./types").CompressionOptions): Promise<Blob>;
export const MIMETYPES_MAP: {
    aac: string;
    abw: string;
    arc: string;
    avi: string;
    azw: string;
    bin: string;
    bmp: string;
    bz: string;
    bz2: string;
    cda: string;
    csh: string;
    css: string;
    csv: string;
    doc: string;
    docx: string;
    eot: string;
    epub: string;
    gif: string;
    gz: string;
    htm: string;
    html: string;
    ico: string;
    ics: string;
    jar: string;
    jpeg: string;
    jpg: string;
    js: string;
    json: string;
    jsonld: string;
    m4a: string;
    mid: string;
    midi: string;
    mjs: string;
    mp3: string;
    mp4: string;
    mpeg: string;
    mpkg: string;
    odp: string;
    ods: string;
    odt: string;
    oga: string;
    ogv: string;
    ogx: string;
    opus: string;
    otf: string;
    png: string;
    pdf: string;
    php: string;
    ppt: string;
    pptx: string;
    rar: string;
    rtf: string;
    sh: string;
    svg: string;
    swf: string;
    tar: string;
    tif: string;
    tiff: string;
    ts: string;
    ttf: string;
    txt: string;
    vsd: string;
    wav: string;
    weba: string;
    webm: string;
    webp: string;
    woff: string;
    woff2: string;
    xhtml: string;
    xls: string;
    xlsx: string;
    xml: string;
    xul: string;
    zip: string;
    '3gp': string;
    '3g2': string;
    '7z': string;
};
//# sourceMappingURL=file.d.ts.map