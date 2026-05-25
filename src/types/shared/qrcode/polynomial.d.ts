export default QRPolynomial;
export namespace QRMath {
    function glog(n: number): number;
    function gexp(n: number): number;
    let EXP_TABLE: any[];
    let LOG_TABLE: any[];
}
declare class QRPolynomial {
    /**
     * @param {number[]} num
     * @param {number} shift
     */
    constructor(num: number[], shift: number);
    num: any[];
    /**
 * @param {number} index
 * @returns {number}
 */
    get(index: number): number;
    /**
 * @returns {number}
 */
    getLength(): number;
    /**
 * @param {QRPolynomial} e
 * @returns {QRPolynomial}
 */
    multiply(e: QRPolynomial): QRPolynomial;
    /**
 * @param {QRPolynomial} e
 * @returns {QRPolynomial}
 */
    mod(e: QRPolynomial): QRPolynomial;
}
//# sourceMappingURL=polynomial.d.ts.map