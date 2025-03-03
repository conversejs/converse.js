import { QRErrorCorrectLevelMap } from './constants';
export type ErrorCorrectLevel = typeof QRErrorCorrectLevelMap[keyof typeof QRErrorCorrectLevelMap];
export type VOption = {
    text: string;
    width?: number;
    height?: number;
    colorDark?: string;
    colorLight?: string;
    correctLevel?: ErrorCorrectLevel;
};
//# sourceMappingURL=types.d.ts.map