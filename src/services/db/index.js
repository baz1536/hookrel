const type = (process.env.DB_TYPE || 'sqlite').toLowerCase();

let adapter;
if (type === 'mongodb') {
    adapter = require('./mongodb');
} else if (type === 'sqlite') {
    adapter = require('./sqlite');
} else {
    throw new Error(`Unknown DB_TYPE "${type}" — must be "sqlite" or "mongodb"`);
}

module.exports = adapter;
