import { log } from '@converse/headless';
import ConverseGif from 'shared/gif/index.js';

// Beyond this many decoded pixels (summed over all frames) we don't keep the
// frames in memory, and instead leave the image for the browser to render.
const MAX_DECODED_PIXELS = 50_000_000;

export default class ConverseWebP extends ConverseGif {
    is_static = false;
    disposed = false;

    /**
     * The element fetches the file and passes it to `handleGIFResponse`,
     * since it has to look at it before deciding to use a player.
     */
    async initialize() {}

    /**
     * Stops playback and frees the decoded frames. The player can't be used afterwards.
     */
    dispose() {
        this.disposed = true;
        this.playing = false;
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
     * @param {ArrayBuffer} data - The WebP file data, as returned by the server
     */
    async handleGIFResponse(data) {
        if (this.disposed) return;

        try {
            await this.decodeFrames(data);
        } catch (e) {
            this.closeFrames();
            if (this.disposed) return;

            log.warn(`Could not decode WebP image ${this.gif_el.src}: ${e.message}`);
            this.showError();
            return;
        }

        if (this.disposed) {
            // Disposed while decoding, so free any frames decoded since.
            this.closeFrames();
            return;
        }

        if (this.is_static) {
            // A single frame has nothing to play, so it's rendered as a regular image.
            this.el.requestUpdate();
            return;
        }

        const { width, height } = this.frames[0].dims;
        this.setSizes(this.options.width ?? width, this.options.height ?? height);
        this.initPlayer();
        if (!this.options.autoplay) this.drawPlayIcon();
    }

    /**
     * @param {ArrayBuffer} data
     */
    async decodeFrames(data) {
        if (!globalThis.ImageDecoder) {
            throw new Error('ImageDecoder is not supported by this browser');
        }
        const decoder = new ImageDecoder({ data, type: 'image/webp' });
        try {
            await decoder.tracks.ready;
            const frame_count = decoder.tracks.selectedTrack.frameCount;
            if (!frame_count) throw new Error('No frames found');

            if (frame_count === 1) {
                this.is_static = true;
                return;
            }

            for (let i = 0; i < frame_count; i++) {
                const { image } = await decoder.decode({ frameIndex: i });
                try {
                    if (this.disposed) return;

                    // Decoded frames are composited to the full image size,
                    // so the first one tells us the total for all of them.
                    const width = image.displayWidth;
                    const height = image.displayHeight;
                    if (i === 0 && width * height * frame_count > MAX_DECODED_PIXELS) {
                        throw new Error('Too large to decode');
                    }
                    this.frames.push({
                        bitmap: await createImageBitmap(image),
                        dims: { width, height, left: 0, top: 0 },
                        delay: (image.duration ?? 0) / 1000, // microseconds to milliseconds
                    });
                } finally {
                    image.close();
                }
            }
        } finally {
            decoder.close();
        }
    }

    /**
     * Unlike GIF patches, decoded WebP frames are already fully composited,
     * so each one replaces the previous one instead of being drawn over it.
     * @param {boolean} show_pause_on_hover
     */
    renderImage(show_pause_on_hover = true) {
        const frame = this.frames[this.frame_idx] ?? this.frames[0];
        if (!frame) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(frame.bitmap, 0, 0, this.canvas.width, this.canvas.height);

        if (show_pause_on_hover && this.hovering) {
            this.drawPauseIcon();
        }
    }
}
