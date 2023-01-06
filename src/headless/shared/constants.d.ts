type ConnectionStatus = {
    0: 'ERROR',
    1: 'CONNECTING',
    13: 'RECONNECTING',
    2: 'CONNFAIL',
    3: 'AUTHENTICATING',
    4: 'AUTHFAIL',
    5: 'CONNECTED',
    6: 'DISCONNECTED',
    7: 'DISCONNECTING',
    8: 'ATTACHED',
    9: 'REDIRECT',
}

export const BOSH_WAIT: 59;
export const CONNECTION_STATUS: ConnectionStatus;
export const CORE_PLUGINS: string[];
export namespace URL_PARSE_OPTIONS {
    const start: RegExp;
}
export const CHAT_STATES: string[];
export namespace KEYCODES {
    const TAB: number;
    const ENTER: number;
    const SHIFT: number;
    const CTRL: number;
    const ALT: number;
    const ESCAPE: number;
    const LEFT_ARROW: number;
    const UP_ARROW: number;
    const RIGHT_ARROW: number;
    const DOWN_ARROW: number;
    const FORWARD_SLASH: number;
    const AT: number;
    const META: number;
    const META_RIGHT: number;
}
