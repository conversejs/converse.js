import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplSocial from './templates/social.js';

import './styles/social.scss';

class SocialApp extends CustomElement {
    render() {
        return tplSocial();
    }
}

api.elements.define('converse-app-social', SocialApp);
