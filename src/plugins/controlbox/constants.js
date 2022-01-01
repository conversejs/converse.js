export const REPORTABLE_STATUSES = [
    0, // ERROR'
    1, // CONNECTING
    2, // CONNFAIL
    3, // AUTHENTICATING
    4, // AUTHFAIL
    7, // DISCONNECTING
   10  // RECONNECTING
];

export const PRETTY_CONNECTION_STATUS = {
    0: 'Error',
    1: 'Connecting',
    2: 'Connection failure',
    3: 'Authenticating',
    4: 'Authentication failure',
    5: 'Connected',
    6: 'Disconnected',
    7: 'Disconnecting',
    8: 'Attached',
    9: 'Redirect',
   10: 'Reconnecting'
};

export const CONNECTION_STATUS_CSS_CLASS = {
   'Error': 'error',
   'Connecting': 'info',
   'Connection failure': 'error',
   'Authenticating': 'info',
   'Authentication failure': 'error',
   'Connected': 'info',
   'Disconnected': 'error',
   'Disconnecting': 'warn',
   'Attached': 'info',
   'Redirect': 'info',
   'Reconnecting': 'warn'
};
