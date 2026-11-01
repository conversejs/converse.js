import { log } from "@converse/headless";
import { getOpenPromise } from "@converse/openpromise";
import { parseGIF, decompressFrames } from "gifuct-js";
import AnimationPlayer from "shared/animation/player.js";

export default class ConverseGif extends AnimationPlayer {
    /**
     * Creates a new ConverseGif instance
     * @param {import('lit').LitElement} el
     * @param {import("shared/animation/types").AnimationPlayerOptions} opts
     */
    constructor(el, opts) {
        super(el, opts);
        this.gif_el = el.querySelector("img");

        // Offscreen canvas with full gif
        this.offscreenCanvas = document.createElement("canvas");
        // Offscreen canvas for patches
        this.patchCanvas = document.createElement("canvas");

        this.frameImageData = null;
        this.disposal_restore_from_idx = null;

        this.initialize();
    }

    async initialize() {
        if (this.options.width && this.options.height) {
            this.setSizes(this.options.width, this.options.height);
        }
        const data = await this.fetchGIF(this.gif_el.src);
        requestAnimationFrame(() => this.handleGIFResponse(data));
    }

    /**
     * @param {number} w
     * @param {number} h
     */
    setSizes(w, h) {
        super.setSizes(w, h);
        this.offscreenCanvas.width = w;
        this.offscreenCanvas.height = h;
        this.offscreenCanvas.style.width = w + "px";
        this.offscreenCanvas.style.height = h + "px";
        this.offscreenCanvas.getContext("2d").setTransform(1, 0, 0, 1, 0, 0);
    }

    /**
     * Starts parsing the GIF stream data by calling `parseGIF` and passing in
     * a map of handler functions.
     * @param {ArrayBuffer} data - The GIF file data, as returned by the server
     */
    handleGIFResponse(data) {
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

    /**
     * @param {number} i
     */
    manageDisposal(i) {
        if (i <= 0) return;

        const offscreenContext = this.offscreenCanvas.getContext("2d");
        const disposal = this.frames[i - 1].disposalType;
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
        if (i > 1) {
            if (disposal === 3) {
                // eslint-disable-next-line no-eq-null
                if (this.disposal_restore_from_idx != null) {
                    offscreenContext.putImageData(this.frames[this.disposal_restore_from_idx].data, 0, 0);
                }
            } else {
                this.disposal_restore_from_idx = i - 1;
            }
        }

        if (disposal === 2) {
            // Restore to background color
            // Browser implementations historically restore to transparent; we do the same.
            // http://www.wizards-toolkit.org/discourse-server/viewtopic.php?f=1&t=21172#p86079
            offscreenContext.clearRect(
                this.last_frame.dims.left,
                this.last_frame.dims.top,
                this.last_frame.dims.width,
                this.last_frame.dims.height
            );
        }
    }

    /**
     * GIF frames are patches, which are composited onto the previous ones
     * according to their disposal method.
     * @param {number} i
     */
    drawFrame(i) {
        this.manageDisposal(i);

        const frame = this.frames[i];
        const patchContext = this.patchCanvas.getContext("2d");
        const offscreenContext = this.offscreenCanvas.getContext("2d");
        const dims = frame.dims;
        if (
            !this.frameImageData ||
            dims.width != this.frameImageData.width ||
            dims.height != this.frameImageData.height
        ) {
            this.patchCanvas.width = dims.width;
            this.patchCanvas.height = dims.height;
            this.frameImageData = patchContext.createImageData(dims.width, dims.height);
        }

        // set the patch data as an override
        this.frameImageData.data.set(frame.patch);
        // draw the patch back over the canvas
        patchContext.putImageData(this.frameImageData, 0, 0);

        offscreenContext.drawImage(this.patchCanvas, dims.left, dims.top);

        const imageData = offscreenContext.getImageData(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        this.ctx.putImageData(imageData, 0, 0);
        this.ctx.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height);

        this.last_frame = frame;
    }

    /**
     * Makes an HTTP request to fetch a GIF
     * @param {string} url
     * @returns {Promise<ArrayBuffer>} Returns a promise which resolves with the response data.
     */
    fetchGIF(url) {
        const promise = getOpenPromise();
        const h = new XMLHttpRequest();
        h.open("GET", url, true);
        h.responseType = "arraybuffer";

        h?.overrideMimeType("text/plain; charset=x-user-defined");
        h.onload = () => {
            if (h.status != 200) {
                this.showError();
                return promise.reject();
            }
            promise.resolve(h.response);
        };
        h.onprogress = (e) => {
            if (!e.lengthComputable) return;
            this.doShowProgress(e.loaded, e.total, true);
        };
        h.onerror = /** @param {ProgressEvent} e */ (e) => {
            log.error(e);
            this.showError();
        };

        h.send();
        return promise;
    }
}
