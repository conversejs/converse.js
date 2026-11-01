export default class ConverseGif extends AnimationPlayer {
    gif_el: HTMLImageElement;
    offscreenCanvas: HTMLCanvasElement;
    patchCanvas: HTMLCanvasElement;
    frameImageData: ImageData;
    disposal_restore_from_idx: number;
    initialize(): Promise<void>;
    /**
     * Starts parsing the GIF stream data by calling `parseGIF` and passing in
     * a map of handler functions.
     * @param {ArrayBuffer} data - The GIF file data, as returned by the server
     */
    handleGIFResponse(data: ArrayBuffer): void;
    hdr: {
        signature: string;
        version: string;
    };
    lsd: {
        backgroundColorIndex: number;
        gct: {
            exists: boolean;
            resolution: number;
            size: number;
            sort: boolean;
        };
        height: number;
        width: number;
        pixelAspectRatio: number;
    };
    /**
     * @param {number} i
     */
    manageDisposal(i: number): void;
    last_frame: any;
    /**
     * Makes an HTTP request to fetch a GIF
     * @param {string} url
     * @returns {Promise<ArrayBuffer>} Returns a promise which resolves with the response data.
     */
    fetchGIF(url: string): Promise<ArrayBuffer>;
}
import AnimationPlayer from "shared/animation/player.js";
//# sourceMappingURL=index.d.ts.map