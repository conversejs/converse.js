export type Paths = {
    config: string; // The account configuration file
    runtime_dir: string; // Owner-only directory holding the socket and pidfile
    socket: string;
    pidfile: string;
    log: string; // Where an auto-spawned daemon writes its output
};

export type Config = {
    jid: string; // Bare JID of the account
    password?: string; // Unset means: look in the system keyring
    websocket_url?: string;
    resource: string;
    consumer: string; // The name a client identifies itself by unless told otherwise
    settings: Record<string, unknown>; // Passed through to converse.initialize
    paths: Paths;
};

export type Status = {
    connected: boolean;
    jid: string | null; // The full JID once bound
    pid: number;
    started: string; // ISO 8601
    uptime: number; // Seconds
};

export type Hello = {
    protocol: number;
    consumer: string;
    access: 'full';
    jid: string | null;
};
