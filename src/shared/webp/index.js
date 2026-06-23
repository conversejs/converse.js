import ConverseGif from "shared/gif/index.js";

export default class ConverseWebP extends ConverseGif {
    /**
     * Create a new ConverseWebP instance.
     * @param {import('./component').default} el
     * @param {import("shared/gif/types").ConverseGifOptions} opts
     */
    constructor(el, opts) {
        super(el, opts);
        this.el = el;
    }

    /**
     * @param {ArrayBuffer} data - The WebP file data, as returned by the server
     */
    async handleGIFResponse(data) {
        await this.loadWebPFrames(data);
        this.setSizes(
            this.options.width ?? this.frames[0].dims.width,
            this.options.height ?? this.frames[0].dims.height
        );

        if (this.frames.length === 1) {
            this.renderImage(false);
            return;
        }

        this.initPlayer();
    }

    /**
     * 
     * @param {ArrayBuffer} fileBuffer 
     */
    async loadWebPFrames(fileBuffer) {
        const decoder = new ImageDecoder({ 
            data: fileBuffer, 
            type: 'image/webp' 
        });

        await decoder.tracks.ready;
        const track = decoder.tracks.selectedTrack;
        const totalFrames = track.frameCount;

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        for (let i = 0; i < totalFrames; i++) {
            const result = await decoder.decode({ frameIndex: i });
            const frameImage = result.image;

            tempCanvas.width = frameImage.codedWidth;
            tempCanvas.height = frameImage.codedHeight;

            tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.drawImage(frameImage, 0, 0);
            const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

            // Build the frame object structure expected by renderImage
            this.frames.push({
                dims: {
                    width: frameImage.codedWidth,
                    height: frameImage.codedHeight,
                    left: 0, // WebP defaults to full frame context per VideoFrame
                    top: 0
                },
                patch: imgData.data, 
                delay: (frameImage.duration || 0) / 1000, 
            });

            frameImage.close();
        }
    }
}
