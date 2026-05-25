/**
 * Get the type by string length
 * @param {String} text
 * @param {Number} nCorrectLevel
 * @return {Number} type
 */
export function getTypeNumber(text: string, nCorrectLevel: number): number;
export namespace QRUtil {
    let G15: number;
    let G18: number;
    let G15_MASK: number;
    /**
     * @param {number} data
     * @returns {number}
     */
    function getBCHTypeInfo(data: number): number;
    /**
     * @param {number} data
     * @returns {number}
     */
    function getBCHTypeNumber(data: number): number;
    /**
     * @param {number} data
     * @returns {number}
     */
    function getBCHDigit(data: number): number;
    /**
     * @param {number} typeNumber
     * @returns {number[]}
     */
    function getPatternPosition(typeNumber: number): number[];
    /**
     * @param {number} maskPattern
     * @param {number} i
     * @param {number} j
     * @returns {boolean}
     */
    function getMask(maskPattern: number, i: number, j: number): boolean;
    /**
     * @param {number} errorCorrectLength
     * @returns {import('./polynomial').default}
     */
    function getErrorCorrectPolynomial(errorCorrectLength: number): import("./polynomial").default;
    /**
     * @param {number} mode
     * @param {number} type
     * @returns {number}
     */
    function getLengthInBits(mode: number, type: number): number;
    /**
     * @param {import('./generator').QRCodeModel} qrCode
     * @returns {number}
     */
    function getLostPoint(qrCode: import("./generator").QRCodeModel): number;
}
//# sourceMappingURL=utils.d.ts.map