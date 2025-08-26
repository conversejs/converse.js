import { converse } from '@converse/headless';
import './view.js';
import './lists.js';
import './plugin.js';

const { Strophe } = converse.env;

Strophe.addNamespace('TODO', 'urn:xmpp:conversejs:todo');
