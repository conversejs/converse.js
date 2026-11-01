/**
 * Plays an animation's frames on a canvas, and draws its controls.
 *
 * It doesn't know about any image format: subclasses load the frames into
 * `this.frames` and draw them with `drawFrame`.
 */
export default class AnimationPlayer {
    /**
     * @param {import('lit').LitElement} el - The element containing the canvas to draw on
     * @param {import("./types").AnimationPlayerOptions} opts
     */
    constructor(el: import("lit").LitElement, opts: import("./types").AnimationPlayerOptions);
    options: {
        width: any;
        height: any;
        autoplay: boolean;
        loop: boolean;
        show_progress_bar: boolean;
        progress_bg_color: string;
        progress_color: string;
        progress_bar_height: number;
    } & import("./types").AnimationPlayerOptions;
    el: import("lit").LitElement;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    ctx_scaled: boolean;
    /** @type {any[]} */ frames: any[];
    load_error: boolean;
    playing: boolean;
    /** @type {number} */ frame_idx: number;
    /** @type {number} */ iteration_count: number;
    hovering: any;
    /** @type {number} */ image_width: number;
    initPlayer(): void;
    /**
     * Gets the index of the frame "up next"
     * @returns {number}
     */
    getNextFrameNo(): number;
    /**
     * Called once we've looped through all frames in the animation
     * @returns {Boolean} - Returns `true` if the animation is now paused (i.e. further iterations are not desired)
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
     * in order to render the animation.
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
     * @param {Number} frame_delay - The delay (in milliseconds)
     * before the currently being shown frame should be replaced by a new one.
     */
    onAnimationFrame(timestamp: DOMHighResTimeStamp, previous_timestamp: DOMHighResTimeStamp, frame_delay: number): void;
    /**
     * @param {number} w
     * @param {number} h
     */
    setSizes(w: number, h: number): void;
    /**
     * @param {number} pos
     * @param {number} length
     * @param {boolean} draw
     */
    doShowProgress(pos: number, length: number, draw: boolean): void;
    drawError(): void;
    showError(): void;
    /**
     * Draws the current frame on the canvas.
     * @param {boolean} show_pause_on_hover
     */
    renderImage(show_pause_on_hover?: boolean): void;
    /**
     * Draws the frame at the given index on the canvas.
     * Implemented by subclasses, since it depends on how frames are stored.
     * @param {number} _i
     */
    drawFrame(_i: number): void;
    /**
     * Start playing the animation
     */
    play(): void;
    /**
     * Pause the animation
     */
    pause(): void;
    drawPauseIcon(): void;
    drawPlayIcon(): void;
    getCanvasScale(): number;
}
//# sourceMappingURL=player.d.ts.map