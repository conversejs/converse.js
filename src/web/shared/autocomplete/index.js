import './component.js';
import AutoComplete from './autocomplete.js';
import { _converse } from '@converse/headless';

import './styles/_autocomplete.scss';

const exports = { AutoComplete };
Object.assign(_converse, exports); // DEPRECATED
Object.assign(_converse.exports, exports);
