/**
 * @copyright Shachaf Ben-Kiki, JC Brand
 * @description
 *  Started as a fork of Shachaf Ben-Kiki's jsgif library
 *  https://github.com/shachaf/jsgif
 * @license MIT License
 */
import Stream from './stream.js';
import { getOpenPromise } from '@converse/openpromise';
import { parseGIF } from './utils.js';

const DELAY_FACTOR = 10;


export default class ConverseGif {

    /**
     * Creates a new ConverseGif instance
     * @param { HTMLElement } el
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
                progress_bar_height: 5
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
        this.disposal_method = null;
        this.disposal_restore_from_idx = null;
        this.frame = null;
        this.frame_offsets = []; // elements have .x and .y properties
        this.frames = [];
        this.last_disposal_method = null;
        this.last_img = null;
        this.load_error = null;
        this.playing = this.options.autoplay;
        this.transparency = null;

        this.frame_idx = 0;
        this.iteration_count = 0;
        this.start = null;

        this.initialize();
    }

    async initialize () {
        if (this.options.width && this.options.height) {
            this.setSizes(this.options.width, this.options.height);
        }
        const data = await this.fetchGIF(this.gif_el.src);
        requestAnimationFrame(() => this.startParsing(data));
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
            const delay = (this.frames[this.frame_idx]?.delay ?? 0) * DELAY_FACTOR;
            setTimeout(() => this.play(), delay);
        }
    }

    /**
     * Gets the index of the frame "up next"
     * @returns {number}
     */
    getNextFrameNo () {
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
     * @param { DOMHighRestTimestamp } timestamp - The timestamp as returned by `requestAnimationFrame`
     * @param { DOMHighRestTimestamp } previous_timestamp - The timestamp from the previous iteration of this method.
     * We need this in order to calculate whether we have waited long enough to
     * show the next frame.
     * @param { Number } frame_delay - The delay (in 1/100th of a second)
     * before the currently being shown frame should be replaced by a new one.
     */
    onAnimationFrame (timestamp, previous_timestamp, frame_delay) {
        if (!this.playing) {
            return;
        }
        if ((timestamp - previous_timestamp) < frame_delay) {
            this.hovering ? this.drawPauseIcon() : this.putFrame(this.frame_idx);
            // We need to wait longer
            requestAnimationFrame(ts => this.onAnimationFrame(ts, previous_timestamp, frame_delay));
            return;
        }
        const next_frame = this.getNextFrameNo();
        if (next_frame === 0 && this.onIterationEnd()) {
            return;
        }
        this.frame_idx = next_frame;
        this.putFrame(this.frame_idx);
        const delay = (this.frames[this.frame_idx]?.delay || 8) * DELAY_FACTOR;
        requestAnimationFrame(ts => this.onAnimationFrame(ts, timestamp, delay));
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

    setFrameOffset (frame, offset) {
        if (!this.frame_offsets[frame]) {
            this.frame_offsets[frame] = offset;
            return;
        }
        if (typeof offset.x !== 'undefined') {
            this.frame_offsets[frame].x = offset.x;
        }
        if (typeof offset.y !== 'undefined') {
            this.frame_offsets[frame].y = offset.y;
        }
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
     * @param { String } data - The GIF file data, as returned by the server
     */
    startParsing (data) {
        const stream = new Stream(data);
        /**
         * @typedef { Object } GIFParserHandlers
         * A map of callback functions passed `parseGIF`. These functions are
         * called as various parts of the GIF file format are parsed.
         * @property { Function } hdr - Callback to handle the GIF header data
         * @property { Function } gce - Callback to handle the GIF Graphic Control Extension data
         * @property { Function } com - Callback to handle the comment extension block
         * @property { Function } img - Callback to handle image data
         * @property { Function } eof - Callback once the end of file has been reached
         */
        const handler = {
            'hdr': this.withProgress(stream, header => this.handleHeader(header)),
            'gce': this.withProgress(stream, gce => this.handleGCE(gce)),
            'com': this.withProgress(stream, ),
            'img': this.withProgress(stream, img => this.doImg(img), true),
            'eof': () => this.handleEOF(stream)
        };
        try {
            parseGIF(stream, handler);
        } catch (err) {
            this.showError('parse');
        }
    }

    drawError () {
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(
            0,
            0,
            this.options.width ? this.options.width : this.hdr.width,
            this.options.height ? this.options.height : this.hdr.height
        );
        this.ctx.strokeStyle = 'red';
        this.ctx.lineWidth = 3;
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(
            this.options.width ? this.options.width : this.hdr.width,
            this.options.height ? this.options.height : this.hdr.height
        );
        this.ctx.moveTo(0, this.options.height ? this.options.height : this.hdr.height);
        this.ctx.lineTo(this.options.width ? this.options.width : this.hdr.width, 0);
        this.ctx.stroke();
    }

    showError (errtype) {
        this.load_error = errtype;
        this.hdr = {
            width: this.gif_el.width,
            height: this.gif_el.height,
        }; // Fake header.
        this.frames = [];
        this.drawError();
        this.el.requestUpdate();
    }

    handleHeader (header) {
        this.hdr = header;
        this.setSizes(
            this.options.width ?? this.hdr.width,
            this.options.height ?? this.hdr.height
        );
    }

    /**
     * Handler for GIF Graphic Control Extension (GCE) data
     */
    handleGCE (gce) {
        this.pushFrame(gce.delayTime);
        this.clear();
        this.transparency = gce.transparencyGiven ? gce.transparencyIndex : null;
        this.disposal_method = gce.disposalMethod;
    }

    /**
     * Handler for when the end of the GIF's file has been reached
     */
    handleEOF (stream) {
        this.doDecodeProgress(stream, false);
        if (!(this.options.width && this.options.height)) {
            this.canvas.width = this.hdr.width * this.getCanvasScale();
            this.canvas.height = this.hdr.height * this.getCanvasScale();
        }
        this.initPlayer();
        !this.options.autoplay && this.drawPlayIcon();
    }

    pushFrame (delay) {
        if (!this.frame) return;
        this.frames.push({
            data: this.frame.getImageData(0, 0, this.hdr.width, this.hdr.height),
            delay,
        });
        this.frame_offsets.push({ x: 0, y: 0 });
    }

    doImg (img) {
        this.frame = this.frame || this.offscreenCanvas.getContext('2d');
        const currIdx = this.frames.length;

        //ct = color table, gct = global color table
        const ct = img.lctFlag ? img.lct : this.hdr.gct; // TODO: What if neither exists?

        /*
         *  Disposal method indicates the way in which the graphic is to
         *  be treated after being displayed.
         *
         *  Values :    0 - No disposal specified. The decoder is
         *                  not required to take any action.
         *              1 - Do not dispose. The graphic is to be left
         *                  in place.
         *              2 - Restore to background color. The area used by the
         *                  graphic must be restored to the background color.
         *              3 - Restore to previous. The decoder is required to
         *                  restore the area overwritten by the graphic with
         *                  what was there prior to rendering the graphic.
         *
         *                  Importantly, "previous" means the frame state
         *                  after the last disposal of method 0, 1, or 2.
         */
        if (currIdx > 0) {
            if (this.last_disposal_method === 3) {
                // Restore to previous
                // If we disposed every frame including first frame up to this point, then we have
                // no composited frame to restore to. In this case, restore to background instead.
                if (this.disposal_restore_from_idx !== null) {
                    this.frame.putImageData(this.frames[this.disposal_restore_from_idx].data, 0, 0);
                } else {
                    this.frame.clearRect(
                        this.last_img.leftPos,
                        this.last_img.topPos,
                        this.last_img.width,
                        this.last_img.height
                    );
                }
            } else {
                this.disposal_restore_from_idx = currIdx - 1;
            }

            if (this.last_disposal_method === 2) {
                // Restore to background color
                // Browser implementations historically restore to transparent; we do the same.
                // http://www.wizards-toolkit.org/discourse-server/viewtopic.php?f=1&t=21172#p86079
                this.frame.clearRect(
                    this.last_img.leftPos,
                    this.last_img.topPos,
                    this.last_img.width,
                    this.last_img.height
                );
            }
        }
        // else, Undefined/Do not dispose.
        // frame contains final pixel data from the last frame; do nothing

        //Get existing pixels for img region after applying disposal method
        const imgData = this.frame.getImageData(img.leftPos, img.topPos, img.width, img.height);

        //apply color table colors
        img.pixels.forEach((pixel, i) => {
            // imgData.data === [R,G,B,A,R,G,B,A,...]
            if (pixel !== this.transparency) {
                imgData.data[i * 4 + 0] = ct[pixel][0];
                imgData.data[i * 4 + 1] = ct[pixel][1];
                imgData.data[i * 4 + 2] = ct[pixel][2];
                imgData.data[i * 4 + 3] = 255; // Opaque.
            }
        });

        this.frame.putImageData(imgData, img.leftPos, img.topPos);

        if (!this.ctx_scaled) {
            this.ctx.scale(this.getCanvasScale(), this.getCanvasScale());
            this.ctx_scaled = true;
        }

        if (!this.last_img) {
            // This is the first receivd image, so we draw it
            this.ctx.drawImage(this.offscreenCanvas, 0, 0);
        }
        this.last_img = img;
    }

    /**
     * Draws a gif frame at a specific index inside the canvas.
     * @param { Number } i - The frame index
     */
    putFrame (i, show_pause_on_hover=true) {
        i = parseInt(i, 10);
        if (i > this.frames.length - 1) {
            i = 0;
        }
        if (i < 0) {
            i = 0;
        }
        const offset = this.frame_offsets[i];
        this.offscreenCanvas.getContext('2d').putImageData(this.frames[i].data, offset.x, offset.y);
        this.ctx.globalCompositeOperation = 'copy';
        this.ctx.drawImage(this.offscreenCanvas, 0, 0);

        if (show_pause_on_hover && this.hovering) {
            this.drawPauseIcon();
        }
    }

    clear () {
        this.transparency = null;
        this.last_disposal_method = this.disposal_method;
        this.disposal_method = null;
        this.frame = null;
    }

    /**
     * Start playing the gif
     */
    play () {
        this.playing = true;
        requestAnimationFrame(ts => this.onAnimationFrame(ts, 0, 0));
    }

    /**
     * Pause the gif
     */
    pause () {
        this.playing = false;
        requestAnimationFrame(() => this.drawPlayIcon())
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

        const icon_size = this.canvas.height*0.1;

        // Draw bars
        this.ctx.lineWidth = this.canvas.height*0.04;
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width/2-icon_size/2, this.canvas.height/2-icon_size);
        this.ctx.lineTo(this.canvas.width/2-icon_size/2, this.canvas.height/2+icon_size);
        this.ctx.fillStyle = 'rgb(200, 200, 200, 0.75)';
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width/2+icon_size/2, this.canvas.height/2-icon_size);
        this.ctx.lineTo(this.canvas.width/2+icon_size/2, this.canvas.height/2+icon_size);
        this.ctx.fillStyle = 'rgb(200, 200, 200, 0.75)';
        this.ctx.stroke();

        // Draw circle
        this.ctx.lineWidth = this.canvas.height*0.02;
        this.ctx.strokeStyle = 'rgb(200, 200, 200, 0.75)';
        this.ctx.beginPath();
        this.ctx.arc(
            this.canvas.width/2,
            this.canvas.height/2,
            icon_size*1.5,
            0,
            2*Math.PI
        );
        this.ctx.stroke();
    }

    drawPlayIcon () {
        if (this.playing) {
            return;
        }

        // Clear the potential pause button by re-rendering the current frame
        this.putFrame(this.frame_idx, false);

        this.ctx.globalCompositeOperation = 'source-over';

        // Draw dark overlay
        this.ctx.fillStyle = 'rgb(0, 0, 0, 0.25)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw triangle
        const triangle_size = this.canvas.height*0.1;
        const region = new Path2D();
        region.moveTo(this.canvas.width/2+triangle_size, this.canvas.height/2); // start at the pointy end
        region.lineTo(this.canvas.width/2-triangle_size/2, this.canvas.height/2+triangle_size);
        region.lineTo(this.canvas.width/2-triangle_size/2, this.canvas.height/2-triangle_size);
        region.closePath();
        this.ctx.fillStyle = 'rgb(200, 200, 200, 0.75)';
        this.ctx.fill(region);

        // Draw circle
        const circle_size = triangle_size*1.5;
        this.ctx.lineWidth = this.canvas.height*0.02;
        this.ctx.strokeStyle = 'rgb(200, 200, 200, 0.75)';
        this.ctx.beginPath();
        this.ctx.arc(
            this.canvas.width/2,
            this.canvas.height/2,
            circle_size,
            0,
            2*Math.PI
        );
        this.ctx.stroke();
    }

    doDecodeProgress (stream, draw) {
        this.doShowProgress(stream.pos, stream.data.length, draw);
    }

    /**
     * @param{boolean=} draw Whether to draw progress bar or not;
     *  this is not idempotent because of translucency.
     *  Note that this means that the text will be unsynchronized
     *  with the progress bar on non-frames;
     *  but those are typically so small (GCE etc.) that it doesn't really matter
     */
    withProgress (stream, fn, draw) {
        return block => {
            fn?.(block);
            this.doDecodeProgress(stream, draw);
        };
    }

    getCanvasScale () {
        let scale;
        if (this.options.max_width && this.hdr && this.hdr.width > this.options.max_width) {
            scale = this.options.max_width / this.hdr.width;
        } else {
            scale = 1;
        }
        return scale;
    }

    /**
     * Makes an HTTP request to fetch a GIF
     * @param { String } url
     * @returns { Promise<String> } Returns a promise which resolves with the response data.
     */
    fetchGIF (url) {
        const promise = getOpenPromise();
        const h = new XMLHttpRequest();
        h.open('GET', url, true);
        h?.overrideMimeType('text/plain; charset=x-user-defined');
        h.onload = () => {
            if (h.status != 200) {
                this.showError('xhr - response');
                return promise.reject();
            }
            promise.resolve(h.response);
        };
        h.onprogress = (e) => (e.lengthComputable && this.doShowProgress(e.loaded, e.total, true));
        h.onerror = () => this.showError('xhr');
        h.send();
        return promise;
    }
}
