const crypto = require('crypto');

function nanoid() {
    return crypto.randomBytes(12).toString('hex');
}

module.exports = { nanoid };
