import dayjs from "dayjs";
import { $build, $iq, $msg, $pres, Strophe, Stanza } from "strophe.js";
import { Model, Collection } from "@converse/skeletor";
import { html, render } from "lit";
import u from "../../utils/index.js";
import sizzle from "sizzle";
/**
 * Utility methods and globals from bundled 3rd party libraries.
 */
export type ConverseEnv = {
    $build: typeof $build;
    $iq: typeof $iq;
    $msg: typeof $msg;
    $pres: typeof $pres;
    Collection: typeof Collection;
    Model: typeof Model;
    Stanza: typeof Stanza;
    Strophe: typeof Strophe;
    TimeoutError: any;
    dayjs: typeof dayjs;
    html: typeof html;
    render: typeof render;
    sizzle: typeof sizzle;
    sprintf: (...args: any[]) => string;
    u: typeof u;
};
//# sourceMappingURL=types.d.ts.map