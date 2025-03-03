export default QRPolynomial;
export namespace QRMath {
    function glog(n: any): any;
    function gexp(n: any): any;
    let EXP_TABLE: any[];
    let LOG_TABLE: any[];
}
declare class QRPolynomial {
    constructor(num: any, shift: any);
    num: any[];
    get(index: any): any;
    getLength(): number;
    multiply(e: any): QRPolynomial;
    mod(e: any): any;
}
//# sourceMappingURL=polynomial.d.ts.map