import { PATTERN_POSITION_TABLE, QRCodeLimitLength, QRErrorCorrectLevelMap, QRMaskPattern, QRMode } from "./constants";
import QRPolynomial, { QRMath } from "./polynomial";

/**
 * Get the type by string length
 * @param {String} text
 * @param {Number} nCorrectLevel
 * @return {Number} type
 */
export function getTypeNumber(text, nCorrectLevel) {
    let nType = 1;
    let length = getUTF8Length(text);

    for (let i = 0, len = QRCodeLimitLength.length; i <= len; i++) {
        let nLimit = 0;

        switch (nCorrectLevel) {
            case QRErrorCorrectLevelMap.L:
                nLimit = QRCodeLimitLength[i][0];
                break;
            case QRErrorCorrectLevelMap.M:
                nLimit = QRCodeLimitLength[i][1];
                break;
            case QRErrorCorrectLevelMap.Q:
                nLimit = QRCodeLimitLength[i][2];
                break;
            case QRErrorCorrectLevelMap.H:
                nLimit = QRCodeLimitLength[i][3];
                break;
        }

        if (length <= nLimit) {
            break;
        } else {
            nType++;
        }
    }

    if (nType > QRCodeLimitLength.length) {
        throw new Error("Too long data");
    }

    return nType;
}

function getUTF8Length(sText) {
    let replacedText = encodeURI(sText)
        .toString()
        .replace(/\%[0-9a-fA-F]{2}/g, "a");
    return replacedText.length + (replacedText.length != sText ? 3 : 0);
}

export const QRUtil = {
    G15: (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18: (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK: (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1),

    getBCHTypeInfo(data) {
        let d = data << 10;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
            d ^= QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15));
        }
        return ((data << 10) | d) ^ QRUtil.G15_MASK;
    },

    getBCHTypeNumber(data) {
        let d = data << 12;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
            d ^= QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18));
        }
        return (data << 12) | d;
    },

    getBCHDigit(data) {
        let digit = 0;
        while (data != 0) {
            digit++;
            data >>>= 1;
        }
        return digit;
    },

    getPatternPosition(typeNumber) {
        return PATTERN_POSITION_TABLE[typeNumber - 1];
    },

    getMask(maskPattern, i, j) {
        switch (maskPattern) {
            case QRMaskPattern.PATTERN000:
                return (i + j) % 2 == 0;
            case QRMaskPattern.PATTERN001:
                return i % 2 == 0;
            case QRMaskPattern.PATTERN010:
                return j % 3 == 0;
            case QRMaskPattern.PATTERN011:
                return (i + j) % 3 == 0;
            case QRMaskPattern.PATTERN100:
                return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
            case QRMaskPattern.PATTERN101:
                return ((i * j) % 2) + ((i * j) % 3) == 0;
            case QRMaskPattern.PATTERN110:
                return (((i * j) % 2) + ((i * j) % 3)) % 2 == 0;
            case QRMaskPattern.PATTERN111:
                return (((i * j) % 3) + ((i + j) % 2)) % 2 == 0;
            default:
                throw new Error("bad maskPattern:" + maskPattern);
        }
    },

    getErrorCorrectPolynomial(errorCorrectLength) {
        let a = new QRPolynomial([1], 0);
        for (let i = 0; i < errorCorrectLength; i++) {
            a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
        }
        return a;
    },

    getLengthInBits(mode, type) {
        if (1 <= type && type < 10) {
            switch (mode) {
                case QRMode.MODE_NUMBER:
                    return 10;
                case QRMode.MODE_ALPHA_NUM:
                    return 9;
                case QRMode.MODE_8BIT_BYTE:
                    return 8;
                case QRMode.MODE_KANJI:
                    return 8;
                default:
                    throw new Error("mode:" + mode);
            }
        } else if (type < 27) {
            switch (mode) {
                case QRMode.MODE_NUMBER:
                    return 12;
                case QRMode.MODE_ALPHA_NUM:
                    return 11;
                case QRMode.MODE_8BIT_BYTE:
                    return 16;
                case QRMode.MODE_KANJI:
                    return 10;
                default:
                    throw new Error("mode:" + mode);
            }
        } else if (type < 41) {
            switch (mode) {
                case QRMode.MODE_NUMBER:
                    return 14;
                case QRMode.MODE_ALPHA_NUM:
                    return 13;
                case QRMode.MODE_8BIT_BYTE:
                    return 16;
                case QRMode.MODE_KANJI:
                    return 12;
                default:
                    throw new Error("mode:" + mode);
            }
        } else {
            throw new Error("type:" + type);
        }
    },

    getLostPoint(qrCode) {
        let moduleCount = qrCode.getModuleCount();
        let lostPoint = 0;
        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                let sameCount = 0;
                let dark = qrCode.isDark(row, col);
                for (let r = -1; r <= 1; r++) {
                    if (row + r < 0 || moduleCount <= row + r) {
                        continue;
                    }
                    for (let c = -1; c <= 1; c++) {
                        if (col + c < 0 || moduleCount <= col + c) {
                            continue;
                        }
                        if (r == 0 && c == 0) {
                            continue;
                        }
                        if (dark == qrCode.isDark(row + r, col + c)) {
                            sameCount++;
                        }
                    }
                }
                if (sameCount > 5) {
                    lostPoint += 3 + sameCount - 5;
                }
            }
        }
        for (let row = 0; row < moduleCount - 1; row++) {
            for (let col = 0; col < moduleCount - 1; col++) {
                let count = 0;
                if (qrCode.isDark(row, col)) count++;
                if (qrCode.isDark(row + 1, col)) count++;
                if (qrCode.isDark(row, col + 1)) count++;
                if (qrCode.isDark(row + 1, col + 1)) count++;
                if (count == 0 || count == 4) {
                    lostPoint += 3;
                }
            }
        }
        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount - 6; col++) {
                if (
                    qrCode.isDark(row, col) &&
                    !qrCode.isDark(row, col + 1) &&
                    qrCode.isDark(row, col + 2) &&
                    qrCode.isDark(row, col + 3) &&
                    qrCode.isDark(row, col + 4) &&
                    !qrCode.isDark(row, col + 5) &&
                    qrCode.isDark(row, col + 6)
                ) {
                    lostPoint += 40;
                }
            }
        }
        for (let col = 0; col < moduleCount; col++) {
            for (let row = 0; row < moduleCount - 6; row++) {
                if (
                    qrCode.isDark(row, col) &&
                    !qrCode.isDark(row + 1, col) &&
                    qrCode.isDark(row + 2, col) &&
                    qrCode.isDark(row + 3, col) &&
                    qrCode.isDark(row + 4, col) &&
                    !qrCode.isDark(row + 5, col) &&
                    qrCode.isDark(row + 6, col)
                ) {
                    lostPoint += 40;
                }
            }
        }
        let darkCount = 0;
        for (let col = 0; col < moduleCount; col++) {
            for (let row = 0; row < moduleCount; row++) {
                if (qrCode.isDark(row, col)) {
                    darkCount++;
                }
            }
        }
        let ratio = Math.abs((100 * darkCount) / moduleCount / moduleCount - 50) / 5;
        lostPoint += ratio * 10;
        return lostPoint;
    },
};
