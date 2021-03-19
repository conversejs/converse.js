import './component.js';
import AutoComplete from './autocomplete.js';
import { FILTER_CONTAINS, FILTER_STARTSWITH } from './utils.js';
import { _converse } from '@converse/headless/core';

import './styles/_autocomplete.scss';

_converse.FILTER_CONTAINS = FILTER_CONTAINS;
_converse.FILTER_STARTSWITH = FILTER_STARTSWITH;
_converse.AutoComplete = AutoComplete;
