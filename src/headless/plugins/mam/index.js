import u from '../../utils/index.js';
import MAMPlaceholderMessage from './placeholder.js';
import { fetchArchivedMessages } from './utils.js';
import './plugin.js';

Object.assign(u, { mam: { fetchArchivedMessages }});

export { MAMPlaceholderMessage };
