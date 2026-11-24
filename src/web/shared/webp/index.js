import { log } from '@converse/headless';
import AnimationPlayer from 'shared/animation/player.js';
import { decodeWebP } from 'shared/webp/utils.js';

export default class ConverseWebP extends AnimationPlayer {
    is_static = false;
    disposed = false;
    abort_controller = new AbortController();

    /**
     * Stops playback and frees the decoded frames. The player can't be used afterwards.
     */
    dispose() {
        this.disposed = true;
        this.playing = false;
        this.abort_controller.abort();
        this.closeFrames();
    }

    play() {
        // initPlayer() may still have a delayed call to play() pending.
        if (this.disposed) return;

        super.play();
    }

    closeFrames() {
        this.frames.forEach((frame) => frame.bitmap.close());
        this.frames = [];
    }

    /**
     * Decodes the WebP file and starts playing it.
     * @param {ArrayBuffer} data - The WebP file data
     */
    async load(data) {
        if (this.disposed) return;

        let result;
        try {
            result = await decodeWebP(data, { signal: this.abort_controller.signal });
        } catch (e) {
            if (this.disposed) return;

            log.warn(`Could not decode WebP image ${this.el.getAttribute('src')}: ${e.message}`);
            this.showError();
            return;
        }

        if (this.disposed) {
            // Disposed just as decoding finished.
            result.frames.forEach((frame) => frame.bitmap.close());
            return;
        }

        if (result.is_static) {
            // A single frame has nothing to play, so it's rendered as a regular image.
            this.is_static = true;
            this.el.requestUpdate();
            return;
        }

        this.frames = result.frames;
        const { width, height } = this.frames[0].dims;
        this.setSizes(this.options.width ?? width, this.options.height ?? height);
        this.initPlayer();
        if (!this.options.autoplay) this.drawPlayIcon();
    }

    /**
     * Decoded WebP frames are already fully composited, so each one replaces
     * the previous one instead of being drawn over it.
     * @param {number} i
     */
    drawFrame(i) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.frames[i].bitmap, 0, 0, this.canvas.width, this.canvas.height);
    }
}
