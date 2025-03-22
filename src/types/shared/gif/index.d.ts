export default class ConverseGif {
    /**
     * Creates a new ConverseGif instance
     * @param {import('lit').LitElement} el
     * @param {import("./types").ConverseGifOptions} opts
     */
    constructor(el: import("lit").LitElement, opts: import("./types").ConverseGifOptions);
    options: {
        width: any;
        height: any;
        autoplay: boolean;
        loop: boolean;
        show_progress_bar: boolean;
        progress_bg_color: string;
        progress_color: string;
        progress_bar_height: number;
    } & import("./types").ConverseGifOptions;
    el: import("lit").LitElement;
    gif_el: HTMLImageElement;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    offscreenCanvas: HTMLCanvasElement;
    patchCanvas: HTMLCanvasElement;
    ctx_scaled: boolean;
    frames: any[];
    load_error: boolean;
    playing: boolean;
    frame_idx: number;
    iteration_count: number;
    start: any;
    hovering: any;
    frameImageData: ImageData;
    disposal_restore_from_idx: number;
    initialize(): Promise<void>;
    initPlayer(): void;
    /**
     * Gets the index of the frame "up next"
     * @returns {number}
     */
    getNextFrameNo(): number;
    /**
     * Called once we've looped through all frames in the GIF
     * @returns {Boolean} - Returns `true` if the GIF is now paused (i.e. further iterations are not desired)
     */
    onIterationEnd(): boolean;
    /**
     * Inner callback for the `requestAnimationFrame` function.
     *
     * This method gets wrapped by an arrow function so that the `previous_timestamp` and
     * `frame_delay` parameters can also be passed in. The `timestamp`
     * parameter comes from `requestAnimationFrame`.
     *
     * The purpose of this method is to call `renderImage` with the right delay
     * in order to render the GIF animation.
     *
     * Note, this method will cause the *next* upcoming frame to be rendered,
     * not the current one.
     *
     * This means `this.frame_idx` will be incremented before calling `this.renderImage`, so
     * `renderImage(0)` needs to be called *before* this method, otherwise the
     * animation will incorrectly start from frame #1 (this is done in `initPlayer`).
     *
     * @param {DOMHighResTimeStamp} timestamp - The timestamp as returned by `requestAnimationFrame`
     * @param {DOMHighResTimeStamp} previous_timestamp - The timestamp from the previous iteration of this method.
     * We need this in order to calculate whether we have waited long enough to
     * show the next frame.
     * @param {Number} frame_delay - The delay (in 1/100th of a second)
     * before the currently being shown frame should be replaced by a new one.
     */
    onAnimationFrame(timestamp: DOMHighResTimeStamp, previous_timestamp: DOMHighResTimeStamp, frame_delay: number): void;
    setSizes(w: any, h: any): void;
    doShowProgress(pos: any, length: any, draw: any): void;
    /**
     * Starts parsing the GIF stream data by calling `parseGIF` and passing in
     * a map of handler functions.
     * @param {ArrayBuffer} data - The GIF file data, as returned by the server
     */
    handleGIFResponse(data: ArrayBuffer): void;
    hdr: {
        signature: string;
        version: string;
    } | {
        width: number;
        height: number;
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
    drawError(): void;
    showError(): void;
    manageDisposal(i: any): void;
    /**
     * Draws a gif frame at a specific index inside the canvas.
     * @param {boolean} show_pause_on_hover - The frame index
     */
    renderImage(show_pause_on_hover?: boolean): void;
    last_frame: any;
    /**
     * Start playing the gif
     */
    play(): void;
    /**
     * Pause the gif
     */
    pause(): void;
    drawPauseIcon(): void;
    drawPlayIcon(): void;
    getCanvasScale(): number;
    /**
     * Makes an HTTP request to fetch a GIF
     * @param {string} url
     * @returns {Promise<ArrayBuffer>} Returns a promise which resolves with the response data.
     */
    fetchGIF(url: string): Promise<ArrayBuffer>;
}
//# sourceMappingURL=index.d.ts.map