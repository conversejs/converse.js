import * as stanza from './stanza.js';
import * as form from './form.js';
import * as html from './html.js';
import * as arraybuffer from './arraybuffer.js';
import * as url from './url.js';
import * as core from './core.js';
import { getOpenPromise } from '@converse/openpromise';

/**
 * The utils object
 * @namespace u
 */
const u = {
    ...stanza,
    ...form,
    ...html,
    ...arraybuffer,
    ...url,
    ...core,
    getResolveablePromise: getOpenPromise,
    getOpenPromise,
};

export default u;
