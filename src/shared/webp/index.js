import log from "@converse/log";
import { getOpenPromise } from "@converse/openpromise";

export default class ConverseWebP {
    /**
     * Create a new ConverseWebP instance.
     * @param {import('./component').default} el
     */
    constructor(el) {
        this.el = el;
        this.initialize();
    }

    async initialize() {
        const data = await this.fetchWebP(this.el.src);
        console.log("Fetched WebP data:", data);
    }

    /**
     * Makes an HTTP request to fetch a WebP image.
     * @param {string} url
     * @returns {Promise<ArrayBuffer>} Returns a promise which resolves with the response data.
     */
    fetchWebP(url) {
        const promise = getOpenPromise();
        const h = new XMLHttpRequest();
        h.open("GET", url, true);
        h.responseType = "arraybuffer";

        h?.overrideMimeType("text/plain; charset=x-user-defined");
        h.onload = () => {
            if (h.status != 200) {
                // this.showError();
                return promise.reject();
            }
            promise.resolve(h.response);
        };
        h.onprogress = (e) => {
            if (!e.lengthComputable) return;
            // this.doShowProgress(e.loaded, e.total, true);
        };
        h.onerror = /** @param {ProgressEvent} e */ (e) => {
            log.error(e);
            // this.showError();
        };

        h.send();
        return promise;
    }
}
