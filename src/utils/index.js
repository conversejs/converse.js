import { u } from '@converse/headless';
import * as color from './color.js';
import * as file from './file.js';
import * as form from './form.js';
import * as html from './html.js';
import * as time from './time.js';
import * as url from './url.js';

// Typed explicitly: the inferred type of `u` can't be named in a declaration file.
/** @type {typeof u & typeof color & typeof file & typeof form & typeof html & typeof time & typeof url} */
const utils = Object.assign(u, {
    ...color,
    ...file,
    ...form,
    ...html,
    ...time,
    ...url,
});

export default utils;
