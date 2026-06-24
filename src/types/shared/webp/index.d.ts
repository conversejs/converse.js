export default class ConverseWebP extends ConverseGif {
    /**
     * Create a new ConverseWebP instance.
     * @param {import('./component').default} el
     * @param {import("shared/gif/types").ConverseGifOptions} opts
     */
    constructor(el: import("./component").default, opts: import("shared/gif/types").ConverseGifOptions);
    el: import("./component").default;
    /**
     * @param {ArrayBuffer} data - The WebP file data, as returned by the server
     */
    handleGIFResponse(data: ArrayBuffer): Promise<void>;
    /**
     *
     * @param {ArrayBuffer} fileBuffer
     */
    loadWebPFrames(fileBuffer: ArrayBuffer): Promise<void>;
}
import ConverseGif from "shared/gif/index.js";
//# sourceMappingURL=index.d.ts.map