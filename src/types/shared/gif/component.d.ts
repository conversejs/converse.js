export default class ConverseGIFElement extends CustomElement {
    static get properties(): {
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
    src: any;
    autoplay: boolean;
    noloop: boolean;
    fallback: string;
    progress_color: any;
    initGIF(): void;
    supergif: ConverseGif;
    updated(changed: any): void;
    render(): string | import("utils/html.js").TemplateResult;
    renderErrorFallback(): string | import("utils/html.js").TemplateResult;
    setHover(): void;
    hover_timeout: NodeJS.Timeout;
    unsetHover(): void;
    onControlsClicked(ev: any): void;
}
import { CustomElement } from 'shared/components/element.js';
import ConverseGif from 'shared/gif/index.js';
//# sourceMappingURL=component.d.ts.map