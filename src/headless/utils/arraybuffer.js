import { converse } from '@converse/headless/core.js';

const { u } = converse.env;


export function appendArrayBuffer (buffer1, buffer2) {
    const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
}

export function arrayBufferToHex (ab) {
    // https://stackoverflow.com/questions/40031688/javascript-arraybuffer-to-hex#40031979
    return Array.prototype.map.call(new Uint8Array(ab), x => ('00' + x.toString(16)).slice(-2)).join('');
}

export function arrayBufferToString (ab) {
    return new TextDecoder("utf-8").decode(ab);
}

export function stringToArrayBuffer (string) {
    const bytes = new TextEncoder("utf-8").encode(string);
    return bytes.buffer;
}

export function arrayBufferToBase64 (ab) {
    return btoa((new Uint8Array(ab)).reduce((data, byte) => data + String.fromCharCode(byte), ''));
}

export function base64ToArrayBuffer (b64) {
    const binary_string =  window.atob(b64),
          len = binary_string.length,
          bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i)
    }
    return bytes.buffer
}

export function hexToArrayBuffer (hex) {
    const typedArray = new Uint8Array(hex.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16)))
    return typedArray.buffer
}


Object.assign(u, { arrayBufferToHex, arrayBufferToString, stringToArrayBuffer, arrayBufferToBase64, base64ToArrayBuffer });
