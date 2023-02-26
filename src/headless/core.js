/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import './shared/constants.js';
import _converse from './shared/_converse';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import api from './shared/api/index.js';
import dayjs from 'dayjs';
import i18n from './shared/i18n';

export { converse } from './shared/api/public.js';
export { _converse };
export { i18n };
export { api };

dayjs.extend(advancedFormat);
