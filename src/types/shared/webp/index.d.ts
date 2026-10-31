export default class ConverseWebP extends ConverseGif {
    is_static: boolean;
    disposed: boolean;
    /**
     * Stops playback and frees the decoded frames. The player can't be used afterwards.
     */
    dispose(): void;
    closeFrames(): void;
    /**
     * @param {ArrayBuffer} data - The WebP file data, as returned by the server
     */
    handleGIFResponse(data: ArrayBuffer): Promise<void>;
    /**
     * @param {ArrayBuffer} data
     */
    decodeFrames(data: ArrayBuffer): Promise<void>;
}
import ConverseGif from 'shared/gif/index.js';
//# sourceMappingURL=index.d.ts.map