import { u } from '@converse/headless';
import * as color from './color.js';
import * as file from './file.js';
import * as form from './form.js';
import * as html from './html.js';
import * as url from './url.js';

export default Object.assign(u, {
    ...color,
    ...file,
    ...form,
    ...html,
    ...url,
});
