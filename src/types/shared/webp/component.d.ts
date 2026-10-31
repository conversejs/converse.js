export default class ConverseWebPElement extends ConverseGIFElement {
    static get properties(): {
        onImgClick: {
            type: FunctionConstructor;
        };
        onImgLoad: {
            type: FunctionConstructor;
        };
        img_error: {
            state: boolean;
        };
        is_animated: {
            state: boolean;
        };
        autoplay: {
            type: BooleanConstructor;
        };
        noloop: {
            type: BooleanConstructor;
        };
        progress_color: {
            type: StringConstructor;
        };
        fallback: {
            type: StringConstructor;
        };
        src: {
            type: StringConstructor;
        };
    };
    onImgClick: any;
    onImgLoad: any;
    img_error: boolean;
    is_animated: boolean;
    probed: boolean;
    /** @type {AbortController} */
    probe_controller: AbortController;
    /** @type {ArrayBuffer} */
    animation_data: ArrayBuffer;
    reset(): void;
    /**
     * Find out whether the image is animated, in which case it's played with
     * a player. Otherwise, it's left to the browser to render.
     */
    probe(): Promise<void>;
}
import ConverseGIFElement from 'shared/gif/component.js';
//# sourceMappingURL=component.d.ts.map