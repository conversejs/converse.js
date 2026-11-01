export default class ConverseWebP extends AnimationPlayer {
    is_static: boolean;
    disposed: boolean;
    abort_controller: AbortController;
    /**
     * Stops playback and frees the decoded frames. The player can't be used afterwards.
     */
    dispose(): void;
    closeFrames(): void;
    /**
     * Decodes the WebP file and starts playing it.
     * @param {ArrayBuffer} data - The WebP file data
     */
    load(data: ArrayBuffer): Promise<void>;
}
import AnimationPlayer from 'shared/animation/player.js';
//# sourceMappingURL=index.d.ts.map