export class QRCodeModel {
    static get PAD0(): number;
    static get PAD1(): number;
    static createData(typeNumber: any, errorCorrectLevel: any, dataList: any): any[];
    static createBytes(buffer: any, rsBlocks: any): any[];
    /**
     * @param {String} text
     * @param {import('./types').ErrorCorrectLevel} errorCorrectLevel
     */
    constructor(text: string, errorCorrectLevel: import("./types").ErrorCorrectLevel);
    text: string;
    errorCorrectLevel: number;
    typeNumber: number;
    modules: any[];
    moduleCount: number;
    dataCache: any[];
    dataList: QR8bitByte[];
    /**
     * @param {number} row
     * @param {number} col
     */
    isDark(row: number, col: number): any;
    getModuleCount(): number;
    make(): void;
    /**
     * @param {boolean} test
     * @param {Number} maskPattern
     */
    makeImpl(test: boolean, maskPattern: number): void;
    /**
     * @param {number} row
     * @param {number} col
     */
    setupPositionProbePattern(row: number, col: number): void;
    /**
     * @returns {Number}
     */
    getBestMaskPattern(): number;
    setupTimingPattern(): void;
    setupPositionAdjustPattern(): void;
    /**
     * @param {boolean} test
     */
    setupTypeNumber(test: boolean): void;
    /**
     * @param {boolean} test
     * @param {Number} maskPattern
     */
    setupTypeInfo(test: boolean, maskPattern: number): void;
    mapData(data: any, maskPattern: any): void;
}
declare class QR8bitByte {
    /**
     * @param {string} data
     */
    constructor(data: string);
    mode: number;
    data: string;
    parsedData: any;
    getLength(): any;
    /**
     * @param {QRBitBuffer} buffer
     */
    write(buffer: QRBitBuffer): void;
}
declare class QRBitBuffer {
    buffer: any[];
    length: number;
    /**
     * @param {Number} index
     */
    get(index: number): boolean;
    /**
     * @param {Number} num
     * @param {Number} length
     */
    put(num: number, length: number): void;
    getLengthInBits(): number;
    /**
     * @param {Boolean} bit
     */
    putBit(bit: boolean): void;
}
export {};
//# sourceMappingURL=generator.d.ts.map