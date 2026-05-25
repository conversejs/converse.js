export default class Stream {
    constructor(data: any);
    data: any;
    len: any;
    pos: number;
    readByte(): number;
    /**
     * @param {number} n
     * @returns {number[]}
     */
    readBytes(n: number): number[];
    /**
     * @param {number} n
     * @returns {string}
     */
    read(n: number): string;
    readUnsigned(): number;
}
//# sourceMappingURL=stream.d.ts.map