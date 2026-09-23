const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const projectRoot = path.join(__dirname, '..', '..');
const envPath = path.join(projectRoot, '.env');

function quoteIdentifier(identifier) {
    return `\`${identifier.replace(/`/g, '``')}\``;
}

/**
 * Carga la configuración local y cambia el proceso a una base exclusiva de
 * pruebas. El sufijo obligatorio `_test` impide eliminar accidentalmente la
 * base de desarrollo al preparar o limpiar los escenarios automatizados.
 */
function configureTestEnvironment(scope) {
    if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
        process.loadEnvFile(envPath);
    }

    if (!/^[a-z0-9_]+$/i.test(scope)) {
        throw new Error('El ámbito de prueba contiene caracteres no permitidos.');
    }

    const sourceDatabase = process.env.DB_NAME || 'tienda_super_wai';
    const baseName = sourceDatabase.replace(/_test$/i, '').slice(0, 40);
    const testDatabase = `${baseName}_${scope}_test`;

    if (!/^[a-z0-9_]+_test$/i.test(testDatabase) || testDatabase === sourceDatabase) {
        throw new Error('El nombre de la base de pruebas no es seguro.');
    }

    const adminConnection = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number.parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        charset: 'utf8mb4',
        multipleStatements: true
    };

    process.env.NODE_ENV = 'test';
    process.env.DB_NAME = testDatabase;
    process.env.DB_CONNECTION_LIMIT = '20';
    process.env.SESSION_SECRET = 'secreto-exclusivo-para-pruebas-automatizadas';
    process.env.SESSION_COOKIE_SECURE = 'false';

    return { adminConnection, testDatabase };
}

async function createTestDatabase(environment) {
    assertSafeTestDatabase(environment.testDatabase);
    const connection = await mysql.createConnection(environment.adminConnection);

    try {
        await connection.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(environment.testDatabase)}`);
        await connection.query(`
            CREATE DATABASE ${quoteIdentifier(environment.testDatabase)}
            CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci
        `);
        await connection.query(`USE ${quoteIdentifier(environment.testDatabase)}`);

        const schema = fs.readFileSync(path.join(projectRoot, 'database', 'schema.sql'), 'utf8')
            .replace(/CREATE DATABASE IF NOT EXISTS[\s\S]*?;/i, '')
            .replace(/USE\s+[a-z0-9_]+\s*;/i, '');
        await connection.query(schema);
    } finally {
        await connection.end();
    }
}

async function dropTestDatabase(environment) {
    assertSafeTestDatabase(environment.testDatabase);
    const connection = await mysql.createConnection(environment.adminConnection);

    try {
        await connection.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(environment.testDatabase)}`);
    } finally {
        await connection.end();
    }
}

function assertSafeTestDatabase(databaseName) {
    if (!/^[a-z0-9_]+_test$/i.test(databaseName)) {
        throw new Error(`Se rechazó una operación destructiva sobre ${databaseName}.`);
    }
}

/** Reinicia los datos y crea cuentas conocidas para cada escenario. */
async function resetFixtures(pool, { includeSecondEmployee = false } = {}) {
    await pool.query('DELETE FROM asistencia');
    await pool.query('DELETE FROM usuarios');
    await pool.query('ALTER TABLE asistencia AUTO_INCREMENT = 1');
    await pool.query('ALTER TABLE usuarios AUTO_INCREMENT = 1');

    const [adminHash, employeeHash] = await Promise.all([
        bcrypt.hash('Admin12345', 4),
        bcrypt.hash('Empleado12345', 4)
    ]);

    const [adminResult] = await pool.query(
        'INSERT INTO usuarios (nombre, email, contrasena, rol) VALUES (?, ?, ?, ?)',
        ['Administradora de Pruebas', 'admin@test.local', adminHash, 'admin']
    );
    const [employeeResult] = await pool.query(
        'INSERT INTO usuarios (nombre, email, contrasena, rol) VALUES (?, ?, ?, ?)',
        ['Empleado de Pruebas', 'empleado@test.local', employeeHash, 'empleado']
    );

    let secondEmployeeId = null;
    if (includeSecondEmployee) {
        const [result] = await pool.query(
            'INSERT INTO usuarios (nombre, email, contrasena, rol) VALUES (?, ?, ?, ?)',
            ['Empleado Ausente', 'ausente@test.local', employeeHash, 'empleado']
        );
        secondEmployeeId = result.insertId;
    }

    return {
        adminId: adminResult.insertId,
        employeeId: employeeResult.insertId,
        secondEmployeeId
    };
}

class HttpTestClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.cookie = '';
    }

    async request(route, { body, headers = {}, ...options } = {}) {
        const requestHeaders = { ...headers };
        if (this.cookie) requestHeaders.Cookie = this.cookie;
        if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';

        const response = await fetch(`${this.baseUrl}${route}`, {
            ...options,
            headers: requestHeaders,
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) this.cookie = setCookie.split(';', 1)[0];

        const responseBody = await response.json().catch(() => null);
        return { status: response.status, body: responseBody };
    }

    login(email, contrasena) {
        return this.request('/api/login', {
            method: 'POST',
            body: { email, contrasena }
        });
    }
}

function listen(app) {
    return new Promise((resolve, reject) => {
        const server = app.listen(0, '127.0.0.1', () => {
            resolve({
                server,
                baseUrl: `http://127.0.0.1:${server.address().port}`
            });
        });
        server.once('error', reject);
    });
}

function closeServer(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
}

module.exports = {
    configureTestEnvironment,
    createTestDatabase,
    dropTestDatabase,
    resetFixtures,
    HttpTestClient,
    listen,
    closeServer
};
