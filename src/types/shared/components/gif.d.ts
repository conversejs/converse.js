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
    supergif: any;
    updated(changed: any): void;
    render(): any;
    renderErrorFallback(): string | import("lit-html").TemplateResult<1>;
    setHover(): void;
    hover_timeout: NodeJS.Timeout;
    unsetHover(): void;
    onControlsClicked(ev: any): void;
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=gif.d.ts.map