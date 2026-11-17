export type EventWithInputTarget = Event & {
    target: HTMLInputElement;
};

// What the UI shows of the connection while a session is open.
export type ConnectionState =
    | 'connected' // There's a working connection
    | 'connecting' // An attempt to connect is underway
    | 'offline'; // No connection, and no attempt underway
