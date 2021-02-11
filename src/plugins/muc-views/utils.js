import { _converse, api } from "@converse/headless/core";


export function getAutoCompleteListItem (text, input) {
    input = input.trim();
    const element = document.createElement('li');
    element.setAttribute('aria-selected', 'false');

    if (api.settings.get('muc_mention_autocomplete_show_avatar')) {
        const img = document.createElement('img');
        let dataUri = 'data:' + _converse.DEFAULT_IMAGE_TYPE + ';base64,' + _converse.DEFAULT_IMAGE;

        if (_converse.vcards) {
            const vcard = _converse.vcards.findWhere({ 'nickname': text });
            if (vcard) dataUri = 'data:' + vcard.get('image_type') + ';base64,' + vcard.get('image');
        }

        img.setAttribute('src', dataUri);
        img.setAttribute('width', '22');
        img.setAttribute('class', 'avatar avatar-autocomplete');
        element.appendChild(img);
    }

    const regex = new RegExp('(' + input + ')', 'ig');
    const parts = input ? text.split(regex) : [text];

    parts.forEach(txt => {
        if (input && txt.match(regex)) {
            const match = document.createElement('mark');
            match.textContent = txt;
            element.appendChild(match);
        } else {
            element.appendChild(document.createTextNode(txt));
        }
    });

    return element;
}
