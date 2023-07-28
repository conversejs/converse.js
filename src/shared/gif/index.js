import { getOpenPromise } from '@converse/openpromise';
import { parseGIF, decompressFrames } from 'gifuct-js';

export default class ConverseGif {
    /**
     * Creates a new ConverseGif instance
     * @param { import('lit').LitElement } el
     * @param { Object } [options]
     * @param { Number } [options.width] - The width, in pixels, of the canvas
     * @param { Number } [options.height] - The height, in pixels, of the canvas
     * @param { Boolean } [options.loop=true] - Setting this to `true` will enable looping of the gif
     * @param { Boolean } [options.autoplay=true] - Same as the rel:autoplay attribute above, this arg overrides the img tag info.
     * @param { Number } [options.max_width] - Scale images over max_width down to max_width. Helpful with mobile.
     * @param { Function } [options.onIterationEnd] - Add a callback for when the gif reaches the end of a single loop (one iteration). The first argument passed will be the gif HTMLElement.
     * @param { Boolean } [options.show_progress_bar=true]
     * @param { String } [options.progress_bg_color='rgba(0,0,0,0.4)']
     * @param { String } [options.progress_color='rgba(255,0,22,.8)']
     * @param { Number } [options.progress_bar_height=5]
     */
    constructor (el, opts) {
        this.options = Object.assign(
            {
                width: null,
                height: null,
                autoplay: true,
                loop: true,
                show_progress_bar: true,
                progress_bg_color: 'rgba(0,0,0,0.4)',
                progress_color: 'rgba(255,0,22,.8)',
                progress_bar_height: 5,
            },
            opts
        );

        this.el = el;
        this.gif_el = el.querySelector('img');
        this.canvas = el.querySelector('canvas');
        this.ctx = this.canvas.getContext('2d');
        // It's good practice to pre-render to an offscreen canvas
        this.offscreenCanvas = document.createElement('canvas');

        this.ctx_scaled = false;
        this.frames = [];
        this.load_error = null;
        this.playing = this.options.autoplay;

        this.frame_idx = 0;
        this.iteration_count = 0;
        this.start = null;
        this.hovering = null;
        this.frameImageData = null;

        this.initialize();
    }

    async initialize () {
        if (this.options.width && this.options.height) {
            this.setSizes(this.options.width, this.options.height);
        }
        const data = await this.fetchGIF(this.gif_el.src);
        requestAnimationFrame(() => this.handleGIFResponse(data));
    }

    initPlayer () {
        if (this.load_error) return;

        if (!(this.options.width && this.options.height)) {
            this.ctx.scale(this.getCanvasScale(), this.getCanvasScale());
        }

        // Show the first frame
        this.frame_idx = 0;
        this.putFrame(this.frame_idx);

        if (this.options.autoplay) {
            const delay = (this.frames[this.frame_idx]?.delay ?? 0);
            setTimeout(() => this.play(), delay);
        }
    }

    /**
     * Gets the index of the frame "up next"
     * @returns {number}
     */
    getNextFrameNo () {
        if (this.frames.length === 0) {
            return 0;
        }
        return (this.frame_idx + 1 + this.frames.length) % this.frames.length;
    }

    /**
     * Called once we've looped through all frames in the GIF
     * @returns { Boolean } - Returns `true` if the GIF is now paused (i.e. further iterations are not desired)
     */
    onIterationEnd () {
        this.iteration_count++;
        this.options.onIterationEnd?.(this);
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
     * The purpose of this method is to call `putFrame` with the right delay
     * in order to render the GIF animation.
     *
     * Note, this method will cause the *next* upcoming frame to be rendered,
     * not the current one.
     *
     * This means `this.frame_idx` will be incremented before calling `this.putFrame`, so
     * `putFrame(0)` needs to be called *before* this method, otherwise the
     * animation will incorrectly start from frame #1 (this is done in `initPlayer`).
     *
     * @param { DOMHighResTimeStamp } timestamp - The timestamp as returned by `requestAnimationFrame`
     * @param { DOMHighResTimeStamp } previous_timestamp - The timestamp from the previous iteration of this method.
     * We need this in order to calculate whether we have waited long enough to
     * show the next frame.
     * @param { Number } frame_delay - The delay (in 1/100th of a second)
     * before the currently being shown frame should be replaced by a new one.
     */
    onAnimationFrame (timestamp, previous_timestamp, frame_delay) {
        if (!this.playing) {
            return;
        }
        if (timestamp - previous_timestamp < frame_delay) {
            this.hovering ? this.drawPauseIcon() : this.putFrame(this.frame_idx);
            // We need to wait longer
            requestAnimationFrame((ts) => this.onAnimationFrame(ts, previous_timestamp, frame_delay));
            return;
        }
        const next_frame = this.getNextFrameNo();
        if (next_frame === 0 && this.onIterationEnd()) {
            return;
        }
        this.frame_idx = next_frame;
        this.putFrame(this.frame_idx);
        const delay = (this.frames[this.frame_idx]?.delay || 8);
        requestAnimationFrame((ts) => this.onAnimationFrame(ts, timestamp, delay));
    }

    setSizes (w, h) {
        this.canvas.width = w * this.getCanvasScale();
        this.canvas.height = h * this.getCanvasScale();

        this.offscreenCanvas.width = w;
        this.offscreenCanvas.height = h;
        this.offscreenCanvas.style.width = w + 'px';
        this.offscreenCanvas.style.height = h + 'px';
        this.offscreenCanvas.getContext('2d').setTransform(1, 0, 0, 1, 0, 0);
    }

    doShowProgress (pos, length, draw) {
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

    /**
     * Starts parsing the GIF stream data by calling `parseGIF` and passing in
     * a map of handler functions.
     * @param {ArrayBuffer} data - The GIF file data, as returned by the server
     */
    handleGIFResponse (data) {
        try {
            const gif = parseGIF(data);
            this.hdr = gif.header;
            this.lsd = gif.lsd;
            this.setSizes(this.options.width ?? this.lsd.width, this.options.height ?? this.lsd.height);
            this.frames = decompressFrames(gif, true);
        } catch (err) {
            this.showError();
        }
        this.initPlayer();
        !this.options.autoplay && this.drawPlayIcon();
    }

    drawError () {
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(
            0,
            0,
            this.options.width ? this.options.width : this.lsd.width,
            this.options.height ? this.options.height : this.lsd.height
        );
        this.ctx.strokeStyle = 'red';
        this.ctx.lineWidth = 3;
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(
            this.options.width ? this.options.width : this.lsd.width,
            this.options.height ? this.options.height : this.lsd.height
        );
        this.ctx.moveTo(0, this.options.height ? this.options.height : this.lsd.height);
        this.ctx.lineTo(this.options.width ? this.options.width : this.lsd.width, 0);
        this.ctx.stroke();
    }

    showError () {
        this.load_error = true;
        this.hdr = {
            width: this.gif_el.width,
            height: this.gif_el.height,
        }; // Fake header.
        this.frames = [];
        this.drawError();
        this.el.requestUpdate();
    }

    /**
     * Draws a gif frame at a specific index inside the canvas.
     * @param {number|string} i - The frame index
     */
    putFrame (i, show_pause_on_hover = true) {
        if (!this.frames.length) return;

        i = parseInt(i.toString(), 10);
        if (i > this.frames.length - 1 || i < 0) {
            i = 0;
        }

        const frame = this.frames[i];
        const dims = frame.dims;

        if (
            !this.frameImageData ||
            dims.width != this.frameImageData.width ||
            dims.height != this.frameImageData.height
        ) {
            this.offscreenCanvas.width = dims.width;
            this.offscreenCanvas.height = dims.height;
            this.frameImageData = this.offscreenCanvas.getContext('2d').createImageData(dims.width, dims.height);
        }

        // set the patch data as an override
        this.frameImageData.data.set(frame.patch);

        this.offscreenCanvas.getContext('2d').putImageData(this.frameImageData, 0, 0);
        this.ctx.globalCompositeOperation = 'copy';
        this.ctx.drawImage(this.offscreenCanvas, dims.left, dims.top);

        if (show_pause_on_hover && this.hovering) {
            this.drawPauseIcon();
        }
    }

    /**
     * Start playing the gif
     */
    play () {
        this.playing = true;
        requestAnimationFrame((ts) => this.onAnimationFrame(ts, 0, 0));
    }

    /**
     * Pause the gif
     */
    pause () {
        this.playing = false;
        requestAnimationFrame(() => this.drawPlayIcon());
    }

    drawPauseIcon () {
        if (!this.playing) {
            return;
        }
        // Clear the potential play button by re-rendering the current frame
        this.putFrame(this.frame_idx, false);

        this.ctx.globalCompositeOperation = 'source-over';

        // Draw dark overlay
        this.ctx.fillStyle = 'rgb(0, 0, 0, 0.25)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const icon_size = this.canvas.height * 0.1;

        // Draw bars
        this.ctx.lineWidth = this.canvas.height * 0.04;
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2 - icon_size / 2, this.canvas.height / 2 - icon_size);
        this.ctx.lineTo(this.canvas.width / 2 - icon_size / 2, this.canvas.height / 2 + icon_size);
        this.ctx.fillStyle = 'rgb(200, 200, 200, 0.75)';
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2 + icon_size / 2, this.canvas.height / 2 - icon_size);
        this.ctx.lineTo(this.canvas.width / 2 + icon_size / 2, this.canvas.height / 2 + icon_size);
        this.ctx.fillStyle = 'rgb(200, 200, 200, 0.75)';
        this.ctx.stroke();

        // Draw circle
        this.ctx.lineWidth = this.canvas.height * 0.02;
        this.ctx.strokeStyle = 'rgb(200, 200, 200, 0.75)';
        this.ctx.beginPath();
        this.ctx.arc(this.canvas.width / 2, this.canvas.height / 2, icon_size * 1.5, 0, 2 * Math.PI);
        this.ctx.stroke();
    }

    drawPlayIcon () {
        if (this.playing) return;

        // Clear the potential pause button by re-rendering the current frame
        this.putFrame(this.frame_idx, false);

        this.ctx.globalCompositeOperation = 'source-over';

        // Draw dark overlay
        this.ctx.fillStyle = 'rgb(0, 0, 0, 0.25)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw triangle
        const triangle_size = this.canvas.height * 0.1;
        const region = new Path2D();
        region.moveTo(this.canvas.width / 2 + triangle_size, this.canvas.height / 2); // start at the pointy end
        region.lineTo(this.canvas.width / 2 - triangle_size / 2, this.canvas.height / 2 + triangle_size);
        region.lineTo(this.canvas.width / 2 - triangle_size / 2, this.canvas.height / 2 - triangle_size);
        region.closePath();
        this.ctx.fillStyle = 'rgb(200, 200, 200, 0.75)';
        this.ctx.fill(region);

        // Draw circle
        const circle_size = triangle_size * 1.5;
        this.ctx.lineWidth = this.canvas.height * 0.02;
        this.ctx.strokeStyle = 'rgb(200, 200, 200, 0.75)';
        this.ctx.beginPath();
        this.ctx.arc(this.canvas.width / 2, this.canvas.height / 2, circle_size, 0, 2 * Math.PI);
        this.ctx.stroke();
    }

    getCanvasScale () {
        let scale;
        if (this.options.max_width && this.hdr && this.lsd.width > this.options.max_width) {
            scale = this.options.max_width / this.lsd.width;
        } else {
            scale = 1;
        }
        return scale;
    }

    /**
     * Makes an HTTP request to fetch a GIF
     * @param { String } url
     * @returns { Promise<ArrayBuffer> } Returns a promise which resolves with the response data.
     */
    fetchGIF (url) {
        const promise = getOpenPromise();
        const h = new XMLHttpRequest();
        h.open('GET', url, true);
        h.responseType = 'arraybuffer';

        h?.overrideMimeType('text/plain; charset=x-user-defined');
        h.onload = () => {
            if (h.status != 200) {
                this.showError();
                return promise.reject();
            }
            promise.resolve(h.response);
        };
        h.onprogress = (e) => e.lengthComputable && this.doShowProgress(e.loaded, e.total, true);
        h.onerror = () => this.showError();
        h.send();
        return promise;
    }
}
