import { QRErrorCorrectLevelMap } from './constants';

export type ErrorCorrectLevel = (typeof QRErrorCorrectLevelMap)[keyof typeof QRErrorCorrectLevelMap];
