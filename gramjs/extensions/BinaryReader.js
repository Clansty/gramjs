const unpack = require("python-struct").unpack;
const {TypeNotFoundError} = require("../errors/Common");
const {coreObjects} = require("../tl/core");
const {tlobjects} = require("../tl/alltlobjects");
const Helpers = require("../utils/Helpers");
class BinaryReader {

    /**
     * Small utility class to read binary data.
     * @param data {Buffer}
     */
    constructor(data) {
        this.stream = data;
        this._last = null;
        this.offset = 0;
    }

    // region Reading

    // "All numbers are written as little endian."
    // https://core.telegram.org/mtproto
    /**
     * Reads a single byte value.
     */
    readByte() {
        return this.read(1)[0];
    }

    /**
     * Reads an integer (4 bytes or 32 bits) value.
     * @param signed {Boolean}
     */
    readInt(signed = true) {
        let res;
        if (signed) {
            res = this.stream.readInt32LE(this.offset);
        } else {
            res = this.stream.readUInt32LE(this.offset);
        }
        this.offset += 4;
        return res;
    }

    /**
     * Reads a long integer (8 bytes or 64 bits) value.
     * @param signed
     * @returns {bigint}
     */
    readLong(signed = true) {
        let res;
        if (signed) {
            res = this.stream.readBigInt64LE(this.offset);
        } else {
            res = this.stream.readBigUInt64LE(this.offset);
        }
        this.offset += 8;

        return res;
    }

    /**
     * Reads a real floating point (4 bytes) value.
     * @returns {number}
     */
    readFloat() {
        return unpack('<f', this.read(4))[0];
    }

    /**
     * Reads a real floating point (8 bytes) value.
     * @returns {BigInt}
     */
    readDouble() {
        return unpack('<f', this.read(8))[0];
    }

    /**
     * Reads a n-bits long integer value.
     * @param bits
     * @param signed {Boolean}
     */
    readLargeInt(bits, signed = true) {
        let buffer = this.read(Math.floor(bits / 8));
        return Helpers.readBigIntFromBuffer(buffer, true, signed);
    }

    /**
     * Read the given amount of bytes, or -1 to read all remaining.
     * @param length {number}
     */
    read(length = -1) {
        if (length === -1) {
            length = this.stream.length - this.offset;
        }
        let result = this.stream.slice(this.offset, this.offset + length);
        this.offset += length;
        if (result.length !== length) {
            throw Error(`No more data left to read (need ${length}, got ${result.length}: ${result}); last read ${this._last}`)
        }
        this._last = result;
        return result;
    }

    /**
     * Gets the byte array representing the current buffer as a whole.
     * @returns {Buffer}
     */
    getBuffer() {
        return this.stream;
    }

    // endregion

    // region Telegram custom reading
    /**
     * Reads a Telegram-encoded byte array, without the need of
     * specifying its length.
     * @returns {Buffer}
     */
    tgReadBytes() {
        let firstByte = this.readByte();
        let padding, length;
        if (firstByte === 254) {
            length = this.readByte() | this.readByte() << 8 | this.readByte() << 16;
            padding = length % 4;
        } else {
            length = firstByte;
            padding = (length + 1) % 4;
        }
        let data = this.read(length);

        if (padding > 0) {
            padding = 4 - padding;
            this.read(padding);
        }

        return data;
    }

    /**
     * Reads a Telegram-encoded string.
     * @returns {string}
     */
    tgReadString() {
        return this.tgReadBytes().toString("utf-8");
    }

    /**
     * Reads a Telegram boolean value.
     * @returns {boolean}
     */
    tgReadBool() {
        let value = this.readInt(false);
        if (value === 0x997275b5) { // boolTrue
            return true;
        } else if (value === 0xbc799737) { //boolFalse
            return false;
        } else {
            throw new Error(`Invalid boolean code ${value.toString("16")}`);
        }
    }

    /**
     * Reads and converts Unix time (used by Telegram)
     * into a Javascript {Date} object.
     * @returns {Date}
     */
    tgReadDate() {
        let value = this.readInt();
        return new Date(value * 1000);
    }

    /**
     * Reads a Telegram object.
     */
    tgReadObject() {
        let constructorId = this.readInt(false);
        let clazz = tlobjects[constructorId];
        if (clazz === undefined) {
            /**
             * The class was None, but there's still a
             * chance of it being a manually parsed value like bool!
             */
            let value = constructorId;
            if (value === 0x997275b5) { // boolTrue
                return true
            } else if (value === 0xbc799737) {  // boolFalse
                return false;
            } else if (value === 0x1cb5c415) {  // Vector
                let temp = [];
                let length = this.readInt();
                for (let i = 0; i < length; i++) {
                    temp.push(this.tgReadObject());
                }
                return temp;
            }

            clazz = coreObjects[constructorId];

            if (clazz === undefined) {
                // If there was still no luck, give up
                this.seek(-4); // Go back
                let pos = this.tellPosition();
                let error = new TypeNotFoundError(constructorId, this.read());
                this.setPosition(pos);
                throw error;
            }

        }
        return clazz.fromReader(this);

    }

    /**
     * Reads a vector (a list) of Telegram objects.
     * @returns {[Buffer]}
     */
    tgReadVector() {
        if (this.readInt(false) !== 0x1cb5c415) {
            throw new Error('Invalid constructor code, vector was expected');
        }
        let count = this.readInt();
        let temp = [];
        for (let i = 0; i < count; i++) {
            temp.push(this.tgReadObject());
        }
        return temp;
    }

    // endregion

    /**
     * Closes the reader.
     */
    close() {
        this.stream = null;
    }

    // region Position related

    /**
     * Tells the current position on the stream.
     * @returns {number}
     */
    tellPosition() {
        return this.offset;
    }

    /**
     * Sets the current position on the stream.
     * @param position
     */
    setPosition(position) {
        this.offset = position;
    }

    /**
     * Seeks the stream position given an offset from the current position.
     * The offset may be negative.
     * @param offset
     */
    seek(offset) {
        this.offset += offset;
    }

    //endregion

}

module.exports = BinaryReader;