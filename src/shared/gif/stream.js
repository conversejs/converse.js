export default class Stream {
    constructor(data) {
        const data_arr = data && data.toString().indexOf('ArrayBuffer') > 0 ? new Uint8Array(data) : data;
        this.data = data_arr;
        this.len = this.data.length;
        this.pos = 0;
    }

    readByte() {
        if (this.pos >= this.data.length) {
            throw new Error('Attempted to read past end of stream.');
        }
        if (this.data instanceof Uint8Array) return this.data[this.pos++];
        else return this.data.charCodeAt(this.pos++) & 0xff;
    }

    /**
     * @param {number} n
     * @returns {number[]}
     */
    readBytes(n) {
        const bytes = [];
        for (let i = 0; i < n; i++) {
            bytes.push(this.readByte());
        }
        return bytes;
    }

    /**
     * @param {number} n
     * @returns {string}
     */
    read(n) {
        let s = '';
        for (let i = 0; i < n; i++) {
            s += String.fromCharCode(this.readByte());
        }
        return s;
    }

    readUnsigned() {
        // Little-endian.
        const a = this.readBytes(2);
        return (a[1] << 8) + a[0];
    }
}
