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
    function getBCHTypeInfo(data: any): number;
    function getBCHTypeNumber(data: any): number;
    function getBCHDigit(data: any): number;
    function getPatternPosition(typeNumber: any): number[];
    function getMask(maskPattern: any, i: any, j: any): boolean;
    function getErrorCorrectPolynomial(errorCorrectLength: any): QRPolynomial;
    function getLengthInBits(mode: any, type: any): 10 | 8 | 9 | 11 | 12 | 16 | 13 | 14;
    function getLostPoint(qrCode: any): number;
}
import QRPolynomial from "./polynomial";
//# sourceMappingURL=utils.d.ts.map