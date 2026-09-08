const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('../config/environment');
const { validateEmail, validateName, validatePassword } = require('../utils/validation');

function validateDatabaseName(databaseName) {
    if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
        throw new Error('DB_NAME contiene caracteres no permitidos.');
    }
}

function isPlaceholder(value) {
    return !value || value.startsWith('REEMPLAZAR_');
}

function quoteIdentifier(identifier) {
    return `\`${String(identifier).replace(/`/g, '``')}\``;
}

async function columnExists(connection, table, column) {
    const [rows] = await connection.query(`
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
    `, [config.db.database, table, column]);
    return rows.length > 0;
}

async function indexExists(connection, table, index) {
    const [rows] = await connection.query(`
        SELECT 1
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
    `, [config.db.database, table, index]);
    return rows.length > 0;
}

async function migrateExistingSchema(connection) {
    await connection.query("UPDATE usuarios SET rol = 'empleado' WHERE rol IS NULL");
    await connection.query('UPDATE usuarios SET activo = TRUE WHERE activo IS NULL');
    await connection.query('UPDATE usuarios SET creado_en = CURRENT_TIMESTAMP WHERE creado_en IS NULL');
    await connection.query(`
        ALTER TABLE usuarios
        MODIFY rol ENUM('admin', 'empleado') NOT NULL DEFAULT 'empleado',
        MODIFY activo BOOLEAN NOT NULL DEFAULT TRUE,
        MODIFY creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    `);

    if (!await columnExists(connection, 'asistencia', 'fecha')) {
        await connection.query(`
            ALTER TABLE asistencia
            ADD COLUMN fecha DATE GENERATED ALWAYS AS (DATE(fecha_hora)) STORED AFTER tipo
        `);
    }

    const [duplicates] = await connection.query(`
        SELECT usuario_id, fecha, tipo, COUNT(*) AS total
        FROM asistencia
        GROUP BY usuario_id, fecha, tipo
        HAVING COUNT(*) > 1
        LIMIT 1
    `);
    if (duplicates.length > 0) {
        throw new Error('Existen marcaciones duplicadas. Corríjalas antes de aplicar la restricción única.');
    }

    if (!await indexExists(connection, 'asistencia', 'uq_asistencia_usuario_fecha_tipo')) {
        await connection.query(`
            CREATE UNIQUE INDEX uq_asistencia_usuario_fecha_tipo
            ON asistencia (usuario_id, fecha, tipo)
        `);
    }

    if (!await indexExists(connection, 'asistencia', 'idx_asistencia_fecha_tipo_hora')) {
        await connection.query(`
            CREATE INDEX idx_asistencia_fecha_tipo_hora
            ON asistencia (fecha, tipo, fecha_hora)
        `);
    }

    const [foreignKeys] = await connection.query(`
        SELECT kcu.CONSTRAINT_NAME, rc.DELETE_RULE
        FROM information_schema.KEY_COLUMN_USAGE kcu
        JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
          ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
         AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
        WHERE kcu.TABLE_SCHEMA = ?
          AND kcu.TABLE_NAME = 'asistencia'
          AND kcu.COLUMN_NAME = 'usuario_id'
          AND kcu.REFERENCED_TABLE_NAME = 'usuarios'
    `, [config.db.database]);

    const currentForeignKey = foreignKeys[0];
    if (!currentForeignKey || currentForeignKey.DELETE_RULE !== 'RESTRICT') {
        if (currentForeignKey) {
            await connection.query(
                `ALTER TABLE asistencia DROP FOREIGN KEY ${quoteIdentifier(currentForeignKey.CONSTRAINT_NAME)}`
            );
        }
        await connection.query(`
            ALTER TABLE asistencia
            ADD CONSTRAINT fk_asistencia_usuario
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
        `);
    }
}

async function seedAdministrator(connection) {
    if (isPlaceholder(config.admin.email) || isPlaceholder(config.admin.password)) {
        throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD deben estar configurados con valores reales.');
    }

    const name = validateName(config.admin.name);
    const email = validateEmail(config.admin.email);
    const password = validatePassword(config.admin.password);
    const [existing] = await connection.query(
        'SELECT id, rol, activo FROM usuarios WHERE email = ?',
        [email]
    );

    if (existing.length > 0) {
        if (existing[0].rol !== 'admin' || !existing[0].activo) {
            throw new Error('ADMIN_EMAIL ya pertenece a una cuenta que no es un administrador activo.');
        }
        console.log('El usuario administrador ya existe.');
        return;
    }

    const hash = await bcrypt.hash(password, 10);
    await connection.query(
        'INSERT INTO usuarios (nombre, email, contrasena, rol) VALUES (?, ?, ?, ?)',
        [name, email, hash, 'admin']
    );
    console.log(`Usuario administrador creado: ${email}`);
}

async function initDatabase() {
    validateDatabaseName(config.db.database);
    if (isPlaceholder(config.db.password)) {
        throw new Error('DB_PASSWORD debe contener la contraseña real de MySQL.');
    }

    console.log('Inicializando base de datos...');
    let connection;

    try {
        connection = await mysql.createConnection({
            host: config.db.host,
            port: config.db.port,
            user: config.db.user,
            password: config.db.password,
            charset: 'utf8mb4'
        });

        await connection.query(`
            CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(config.db.database)}
            CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci
        `);
        await connection.query(`USE ${quoteIdentifier(config.db.database)}`);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL,
                contrasena VARCHAR(255) NOT NULL,
                rol ENUM('admin', 'empleado') NOT NULL DEFAULT 'empleado',
                activo BOOLEAN NOT NULL DEFAULT TRUE,
                creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_usuarios_email (email)
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS asistencia (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                tipo ENUM('entrada', 'salida') NOT NULL,
                fecha DATE GENERATED ALWAYS AS (DATE(fecha_hora)) STORED,
                fecha_hora DATETIME NOT NULL,
                CONSTRAINT fk_asistencia_usuario
                    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
                UNIQUE KEY uq_asistencia_usuario_fecha_tipo (usuario_id, fecha, tipo),
                KEY idx_asistencia_fecha_tipo_hora (fecha, tipo, fecha_hora)
            ) ENGINE=InnoDB
        `);

        await migrateExistingSchema(connection);
        await seedAdministrator(connection);
        console.log('Base de datos inicializada y verificada correctamente.');
    } finally {
        if (connection) await connection.end();
    }
}

initDatabase().catch((error) => {
    console.error('Error al inicializar la base de datos:', error.message);
    process.exit(1);
});
