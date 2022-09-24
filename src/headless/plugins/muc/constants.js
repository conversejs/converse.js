export const ROLES = ['moderator', 'participant', 'visitor'];
export const AFFILIATIONS = ['owner', 'admin', 'member', 'outcast', 'none'];

export const MUC_ROLE_WEIGHTS = {
    'moderator': 1,
    'participant': 2,
    'visitor': 3,
    'none': 2,
};

export const AFFILIATION_CHANGES = {
    OWNER: 'owner',
    ADMIN: 'admin',
    MEMBER: 'member',
    EXADMIN: 'exadmin',
    EXOWNER: 'exowner',
    EXOUTCAST: 'exoutcast',
    EXMEMBER: 'exmember',
};

export const AFFILIATION_CHANGES_LIST = Object.values(AFFILIATION_CHANGES);
export const MUC_TRAFFIC_STATES = { ENTERED: 'entered', EXITED: 'exited' };
export const MUC_TRAFFIC_STATES_LIST = Object.values(MUC_TRAFFIC_STATES);
export const MUC_ROLE_CHANGES = { OP: 'op', DEOP: 'deop', VOICE: 'voice', MUTE: 'mute' };
export const MUC_ROLE_CHANGES_LIST = Object.values(MUC_ROLE_CHANGES);

export const INFO_CODES = {
    'visibility_changes': ['100', '102', '103', '172', '173', '174'],
    'self': ['110'],
    'non_privacy_changes': ['104', '201'],
    'muc_logging_changes': ['170', '171'],
    'nickname_changes': ['210', '303'],
    'disconnected': ['301', '307', '321', '322', '332', '333'],
    'affiliation_changes': [...AFFILIATION_CHANGES_LIST],
    'join_leave_events': [...MUC_TRAFFIC_STATES_LIST],
    'role_changes': [...MUC_ROLE_CHANGES_LIST],
};

export const ROOMSTATUS = {
    CONNECTED: 0,
    CONNECTING: 1,
    NICKNAME_REQUIRED: 2,
    PASSWORD_REQUIRED: 3,
    DISCONNECTED: 4,
    ENTERED: 5,
    DESTROYED: 6,
    BANNED: 7,
    CLOSING: 8,
};

export const ROOM_FEATURES = [
    'passwordprotected',
    'unsecured',
    'hidden',
    'publicroom',
    'membersonly',
    'open',
    'persistent',
    'temporary',
    'nonanonymous',
    'semianonymous',
    'moderated',
    'unmoderated',
    'mam_enabled',
];

export const MUC_NICK_CHANGED_CODE = '303';

// No longer used in code, but useful as reference.
//
// const ROOM_FEATURES_MAP = {
//     'passwordprotected': 'unsecured',
//     'unsecured': 'passwordprotected',
//     'hidden': 'publicroom',
//     'publicroom': 'hidden',
//     'membersonly': 'open',
//     'open': 'membersonly',
//     'persistent': 'temporary',
//     'temporary': 'persistent',
//     'nonanonymous': 'semianonymous',
//     'semianonymous': 'nonanonymous',
//     'moderated': 'unmoderated',
//     'unmoderated': 'moderated'
// };
