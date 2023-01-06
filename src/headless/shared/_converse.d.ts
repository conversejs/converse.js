export default _converse;
declare namespace _converse {
    export { log };
    export { CONNECTION_STATUS };
    export const templates: {};
    export namespace promises {
        const initialized: any;
    }
    export namespace STATUS_WEIGHTS {
        const offline: number;
        const unavailable: number;
        const xa: number;
        const away: number;
        const dnd: number;
        const chat: number;
        const online: number;
    }
    export const ANONYMOUS: string;
    export const CLOSED: string;
    export const EXTERNAL: string;
    export const LOGIN: string;
    export const LOGOUT: string;
    export const OPENED: string;
    export const PREBIND: string;
    export const STANZA_TIMEOUT: number;
    export const SUCCESS: string;
    export const FAILURE: string;
    export const DEFAULT_IMAGE_TYPE: string;
    export const DEFAULT_IMAGE: string;
    export namespace TIMEOUTS {
        const PAUSED: number;
        const INACTIVE: number;
    }
    const INACTIVE_1: string;
    export { INACTIVE_1 as INACTIVE };
    export const ACTIVE: string;
    export const COMPOSING: string;
    const PAUSED_1: string;
    export { PAUSED_1 as PAUSED };
    export const GONE: string;
    export const PRIVATE_CHAT_TYPE: string;
    export const CHATROOMS_TYPE: string;
    export const HEADLINES_TYPE: string;
    export const CONTROLBOX_TYPE: string;
    export namespace default_connection_options {
        const explicitResourceBinding: boolean;
    }
    export const router: Router;
    export { TimeoutError };
    export function isTestEnv(): boolean;
    export { getDefaultStore };
    export { createStore };
    export function __(...args: any[]): any;
    export function ___(str: string): string;
}
import log from "../log.js";
import { CONNECTION_STATUS } from "./constants";
import { Router } from "@converse/skeletor/src/router.js";
import { TimeoutError } from "./errors.js";
import { getDefaultStore } from "../utils/storage.js";
import { createStore } from "../utils/storage.js";
