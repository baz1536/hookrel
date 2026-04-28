const bcrypt = require('bcryptjs');
const repo = require('../repositories/users');

const SALT_ROUNDS = 12;

async function findUserByUsername(username) {
    return repo.findByUsername(username);
}

async function findUserById(id) {
    return repo.findById(id);
}

async function listUsers() {
    return repo.listAll();
}

async function countUsers() {
    return repo.count();
}

async function createUser(username, password, role = 'user') {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    return repo.create(username, passwordHash, role);
}

async function updateUser(id, updates) {
    const fields = { updatedAt: new Date() };
    if (updates.password) fields.passwordHash = await bcrypt.hash(updates.password, SALT_ROUNDS);
    if (updates.role)     fields.role = updates.role;
    if (updates.username) fields.username = updates.username;
    return repo.update(id, fields);
}

async function deleteUser(id) {
    return repo.remove(id);
}

async function verifyPassword(user, password) {
    return bcrypt.compare(password, user.passwordHash);
}

async function isFirstLaunch() {
    return (await countUsers()) === 0;
}

module.exports = {
    findUserByUsername, findUserById, listUsers, countUsers,
    createUser, updateUser, deleteUser, verifyPassword, isFirstLaunch,
};
