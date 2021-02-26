import xss from 'xss/dist/xss';

const element = document.createElement('div');

export function decodeHTMLEntities (str) {
    if (str && typeof str === 'string') {
        element.innerHTML = xss.filterXSS(str);
        str = element.textContent;
        element.textContent = '';
    }
    return str;
}
