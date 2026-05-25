export class QRCodeModel {
    static get PAD0(): number;
    static get PAD1(): number;
    /**
     * @param {Number} typeNumber
     * @param {import('./types').ErrorCorrectLevel} errorCorrectLevel
     * @param {any[]} dataList
     */
    static createData(typeNumber: number, errorCorrectLevel: import("./types").ErrorCorrectLevel, dataList: any[]): number[];
    /**
     * @param {QRBitBuffer} buffer
     * @param {QRRSBlock[]} rsBlocks
     * @returns {number[]}
     */
    static createBytes(buffer: QRBitBuffer, rsBlocks: QRRSBlock[]): number[];
    /**
     * @param {String} text
     * @param {import('./types').ErrorCorrectLevel} errorCorrectLevel
     */
    constructor(text: string, errorCorrectLevel: import("./types").ErrorCorrectLevel);
    text: string;
    errorCorrectLevel: number;
    typeNumber: number;
    /** @type {any[][]|null} */ modules: any[][] | null;
    moduleCount: number;
    dataCache: number[];
    /** @type {any[]} */ dataList: any[];
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
    /**
     * @param {*} data
     * @param {Number} maskPattern
     */
    mapData(data: any, maskPattern: number): void;
}
declare class QRBitBuffer {
    /** @type {number[]} */ buffer: number[];
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
declare class QRRSBlock {
    /**
     * @param {Number} typeNumber
     * @param {import('./types').ErrorCorrectLevel} errorCorrectLevel
     * @returns {QRRSBlock[]}
     */
    static getRSBlocks(typeNumber: number, errorCorrectLevel: import("./types").ErrorCorrectLevel): QRRSBlock[];
    /**
     * @param {Number} typeNumber
     * @param {import('./types').ErrorCorrectLevel} errorCorrectLevel
     * @returns {number[]|undefined}
     */
    static getRsBlockTable(typeNumber: number, errorCorrectLevel: import("./types").ErrorCorrectLevel): number[] | undefined;
    /**
     * @param {number} totalCount
     * @param {number} dataCount
     */
    constructor(totalCount: number, dataCount: number);
    totalCount: number;
    dataCount: number;
}
export {};
//# sourceMappingURL=generator.d.ts.map