export const WebSocket = window.WebSocket;
export const DOMParser = window.DOMParser;

export function getDummyXMLDOMDocument () {
    return document.implementation.createDocument('jabber:client', 'strophe', null);
}
