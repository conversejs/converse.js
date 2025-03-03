import { QRErrorCorrectLevelMap } from './constants';

export type ErrorCorrectLevel = typeof QRErrorCorrectLevelMap[keyof typeof QRErrorCorrectLevelMap];

export type VOption = {
     text: string; // QRCode link data
     width?: number; // Default value is 256
     height?: number; // Default value is 256
     colorDark?: string; // Default "#000000"
     colorLight?: string; // Default "#ffffff"
     correctLevel?: ErrorCorrectLevel;
}
