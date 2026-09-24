const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// La configuración se centraliza para que el resto del sistema no lea process.env directamente.
const envPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
}

/** Lee una variable entera positiva o utiliza el valor predeterminado. */
function readInteger(name, fallback) {
    const rawValue = process.env[name];
    if (rawValue === undefined || rawValue === '') return fallback;

    const value = Number.parseInt(rawValue, 10);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} debe ser un número entero positivo.`);
    }

    return value;
}

/** Lee una variable booleana; únicamente el texto "true" representa verdadero. */
function readBoolean(name, fallback) {
    const rawValue = process.env[name];
    if (rawValue === undefined || rawValue === '') return fallback;
    return rawValue.toLowerCase() === 'true';
}

const nodeEnv = process.env.NODE_ENV || 'development';
const configuredSessionSecret = process.env.SESSION_SECRET;

if (!configuredSessionSecret && nodeEnv === 'production') {
    throw new Error('SESSION_SECRET es obligatorio en producción.');
}

const config = {
    nodeEnv,
    port: readInteger('PORT', 3000),
    db: {
        host: process.env.DB_HOST || '127.0.0.1',
        port: readInteger('DB_PORT', 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'tienda_super_wai',
        connectionLimit: readInteger('DB_CONNECTION_LIMIT', 10)
    },
    session: {
        name: process.env.SESSION_COOKIE_NAME || 'asistencia.sid',
        secret: configuredSessionSecret || crypto.randomBytes(32).toString('hex'),
        maxAgeMs: readInteger('SESSION_MAX_AGE_MS', 24 * 60 * 60 * 1000),
        secureCookie: readBoolean('SESSION_COOKIE_SECURE', nodeEnv === 'production')
    },
    business: {
        timeZone: process.env.BUSINESS_TIMEZONE || 'America/Santiago'
    },
    admin: {
        name: process.env.ADMIN_NAME || 'Administrador',
        email: process.env.ADMIN_EMAIL || '',
        password: process.env.ADMIN_PASSWORD || ''
    }
};

try {
    new Intl.DateTimeFormat('es-CL', { timeZone: config.business.timeZone }).format();
} catch (error) {
    throw new Error('BUSINESS_TIMEZONE no corresponde a una zona horaria válida.');
}

if (!configuredSessionSecret && nodeEnv !== 'test') {
    console.warn('SESSION_SECRET no está configurado; se usará un secreto temporal durante esta ejecución.');
}

module.exports = config;
