const mysql = require('mysql2/promise');
const config = require('../config/environment');

/**
 * Pool compartido por los modelos y middlewares.
 * `dateStrings` evita conversiones automáticas de DATETIME según la zona del proceso.
 */
const pool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    charset: 'utf8mb4',
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: config.db.connectionLimit,
    queueLimit: 0
});

module.exports = pool;
