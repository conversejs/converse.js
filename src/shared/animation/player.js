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
    constructor(el, opts) {
        this.options = Object.assign(
            {
                width: null,
                height: null,
                autoplay: true,
                loop: true,
                show_progress_bar: true,
                progress_bg_color: "rgba(0,0,0,0.4)",
                progress_color: "rgba(255,0,22,.8)",
                progress_bar_height: 5,
            },
            opts
        );

        this.el = el;
        this.canvas = el.querySelector("canvas");
        this.ctx = this.canvas.getContext("2d");

        this.ctx_scaled = false;
        /** @type {any[]} */ this.frames = [];
        this.load_error = null;
        this.playing = this.options.autoplay;

        /** @type {number} */ this.frame_idx = 0;
        /** @type {number} */ this.iteration_count = 0;
        this.hovering = null;
        // The unscaled width of the image
        /** @type {number} */ this.image_width = null;
    }

    initPlayer() {
        if (this.load_error) return;

        if (!(this.options.width && this.options.height)) {
            this.ctx.scale(this.getCanvasScale(), this.getCanvasScale());
        }

        // Show the first frame
        this.frame_idx = 0;
        this.renderImage();

        if (this.options.autoplay) {
            const delay = this.frames[this.frame_idx]?.delay ?? 0;
            setTimeout(() => this.play(), delay);
        }
    }

    /**
     * Gets the index of the frame "up next"
     * @returns {number}
     */
    getNextFrameNo() {
        if (this.frames.length === 0) {
            return 0;
        }
        return (this.frame_idx + 1 + this.frames.length) % this.frames.length;
    }

    /**
     * Called once we've looped through all frames in the animation
     * @returns {Boolean} - Returns `true` if the animation is now paused (i.e. further iterations are not desired)
     */
    onIterationEnd() {
        this.iteration_count++;
        this.options.onIterationEnd?.(this.el);
        if (!this.options.loop) {
            this.pause();
            return true;
        }
        return false;
    }

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
    onAnimationFrame(timestamp, previous_timestamp, frame_delay) {
        if (!this.playing) {
            return;
        }
        if (timestamp - previous_timestamp < frame_delay) {
            if (this.hovering) {
                this.drawPauseIcon();
            } else {
                this.renderImage();
            }
            // We need to wait longer
            requestAnimationFrame((ts) => this.onAnimationFrame(ts, previous_timestamp, frame_delay));
            return;
        }
        const next_frame = this.getNextFrameNo();
        if (next_frame === 0 && this.onIterationEnd()) {
            return;
        }
        this.frame_idx = next_frame;
        this.renderImage();
        const delay = this.frames[this.frame_idx]?.delay || 8;
        requestAnimationFrame((ts) => this.onAnimationFrame(ts, timestamp, delay));
    }

    /**
     * @param {number} w
     * @param {number} h
     */
    setSizes(w, h) {
        this.image_width = w;
        this.canvas.width = w * this.getCanvasScale();
        this.canvas.height = h * this.getCanvasScale();
    }

    /**
     * @param {number} pos
     * @param {number} length
     * @param {boolean} draw
     */
    doShowProgress(pos, length, draw) {
        if (draw && this.options.show_progress_bar) {
            let height = this.options.progress_bar_height;
            const top = (this.canvas.height - height) / (this.ctx_scaled ? this.getCanvasScale() : 1);
            const mid = ((pos / length) * this.canvas.width) / (this.ctx_scaled ? this.getCanvasScale() : 1);
            const width = this.canvas.width / (this.ctx_scaled ? this.getCanvasScale() : 1);
            height /= this.ctx_scaled ? this.getCanvasScale() : 1;

            this.ctx.fillStyle = this.options.progress_bg_color;
            this.ctx.fillRect(mid, top, width - mid, height);

            this.ctx.fillStyle = this.options.progress_color;
            this.ctx.fillRect(0, top, mid, height);
        }
    }

    drawError() {
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, this.options.width, this.options.height);
        this.ctx.strokeStyle = "red";
        this.ctx.lineWidth = 3;
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(this.options.width, this.options.height);
        this.ctx.moveTo(0, this.options.height);
        this.ctx.lineTo(this.options.width, 0);
        this.ctx.stroke();
    }

    showError() {
        this.load_error = true;
        this.frames = [];
        this.drawError();
        this.el.requestUpdate();
    }

    /**
     * Draws the current frame on the canvas.
     * @param {boolean} show_pause_on_hover
     */
    renderImage(show_pause_on_hover = true) {
        if (!this.frames.length) return;

        let i = this.frame_idx;
        if (i > this.frames.length - 1 || i < 0) {
            i = 0;
        }
        this.drawFrame(i);

        if (show_pause_on_hover && this.hovering) {
            this.drawPauseIcon();
        }
    }

    /**
     * Draws the frame at the given index on the canvas.
     * Implemented by subclasses, since it depends on how frames are stored.
     * @param {number} _i
     */
    drawFrame(_i) {
        throw new Error('drawFrame is not implemented');
    }

    /**
     * Start playing the animation
     */
    play() {
        this.playing = true;
        requestAnimationFrame((ts) => this.onAnimationFrame(ts, 0, 0));
    }

    /**
     * Pause the animation
     */
    pause() {
        this.playing = false;
        requestAnimationFrame(() => this.drawPlayIcon());
    }

    drawPauseIcon() {
        if (!this.playing) return;

        // Clear the potential play button by re-rendering the current frame
        this.renderImage(false);

        // Draw dark overlay
        this.ctx.fillStyle = "rgb(0, 0, 0, 0.25)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const icon_size = this.canvas.height * 0.1;
        // Draw bars
        this.ctx.lineWidth = this.canvas.height * 0.04;
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2 - icon_size / 2, this.canvas.height / 2 - icon_size);
        this.ctx.lineTo(this.canvas.width / 2 - icon_size / 2, this.canvas.height / 2 + icon_size);
        this.ctx.fillStyle = "rgb(200, 200, 200, 0.75)";
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2 + icon_size / 2, this.canvas.height / 2 - icon_size);
        this.ctx.lineTo(this.canvas.width / 2 + icon_size / 2, this.canvas.height / 2 + icon_size);
        this.ctx.fillStyle = "rgb(200, 200, 200, 0.75)";
        this.ctx.stroke();

        // Draw circle
        this.ctx.lineWidth = this.canvas.height * 0.02;
        this.ctx.strokeStyle = "rgb(200, 200, 200, 0.75)";
        this.ctx.beginPath();
        this.ctx.arc(this.canvas.width / 2, this.canvas.height / 2, icon_size * 1.5, 0, 2 * Math.PI);
        this.ctx.stroke();
    }

    drawPlayIcon() {
        if (this.playing) return;

        // Clear the potential pause button by re-rendering the current frame
        this.renderImage(false);
        // Draw dark overlay
        this.ctx.fillStyle = "rgb(0, 0, 0, 0.25)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw triangle
        const triangle_size = this.canvas.height * 0.1;
        const region = new Path2D();
        region.moveTo(this.canvas.width / 2 + triangle_size, this.canvas.height / 2); // start at the pointy end
        region.lineTo(this.canvas.width / 2 - triangle_size / 2, this.canvas.height / 2 + triangle_size);
        region.lineTo(this.canvas.width / 2 - triangle_size / 2, this.canvas.height / 2 - triangle_size);
        region.closePath();
        this.ctx.fillStyle = "rgb(200, 200, 200, 0.75)";
        this.ctx.fill(region);

        // Draw circle
        const circle_size = triangle_size * 1.5;
        this.ctx.lineWidth = this.canvas.height * 0.02;
        this.ctx.strokeStyle = "rgb(200, 200, 200, 0.75)";
        this.ctx.beginPath();
        this.ctx.arc(this.canvas.width / 2, this.canvas.height / 2, circle_size, 0, 2 * Math.PI);
        this.ctx.stroke();
    }

    getCanvasScale() {
        const { max_width } = this.options;
        if (max_width && this.image_width > max_width) {
            return max_width / this.image_width;
        }
        return 1;
    }
}
