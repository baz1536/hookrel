const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

function getKey() {
    const hex = process.env.ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) throw new Error('ENCRYPTION_KEY must be a 64-char hex string');
    return Buffer.from(hex, 'hex');
}

// Returns "enc:<iv_hex>:<tag_hex>:<ct_hex>"
function encrypt(plaintext) {
    const key = getKey();
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`;
}

function decrypt(encoded) {
    if (!isEncrypted(encoded)) return encoded;
    const parts = encoded.split(':');
    if (parts.length !== 4) throw new Error('Invalid encrypted format');
    const [, ivHex, tagHex, ctHex] = parts;
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return decipher.update(Buffer.from(ctHex, 'hex')) + decipher.final('utf8');
}

function isEncrypted(value) {
    return typeof value === 'string' && value.startsWith('enc:');
}

// Replace encrypted values with "********" for safe API responses
function redact(value) {
    return isEncrypted(value) ? '********' : value;
}

module.exports = { encrypt, decrypt, isEncrypted, redact };
