import u from '../../utils/index.js';
import MUCMessage from './message.js';
import MUCMessages from './messages.js';
import MUC from './muc.js';
import MUCOccupant from './occupant.js';
import MUCOccupants from './occupants.js';
import './plugin.js';

import { isChatRoom } from './utils.js';
import { setAffiliation } from './affiliations/utils.js';
Object.assign(u, { muc: { isChatRoom, setAffiliation }});

export { MUCMessage, MUCMessages, MUC, MUCOccupant, MUCOccupants };
