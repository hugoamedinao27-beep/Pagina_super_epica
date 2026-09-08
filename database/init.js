const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('../config/environment');

function validateDatabaseName(databaseName) {
    if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
        throw new Error('DB_NAME contiene caracteres no permitidos.');
    }
}

async function initDatabase() {
    validateDatabaseName(config.db.database);

    if (!config.admin.email || !config.admin.password) {
        throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD son obligatorios para inicializar la base de datos.');
    }

    console.log('Inicializando base de datos...');
    let connection;

    try {
        connection = await mysql.createConnection({
            host: config.db.host,
            port: config.db.port,
            user: config.db.user,
            password: config.db.password
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\``);
        await connection.query(`USE \`${config.db.database}\``);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                contrasena VARCHAR(255) NOT NULL,
                rol ENUM('admin', 'empleado') DEFAULT 'empleado',
                activo BOOLEAN DEFAULT TRUE,
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS asistencia (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                tipo ENUM('entrada', 'salida') NOT NULL,
                fecha_hora DATETIME NOT NULL,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
            )
        `);

        const normalizedEmail = config.admin.email.trim().toLowerCase();
        const [existing] = await connection.query(
            'SELECT id FROM usuarios WHERE email = ?',
            [normalizedEmail]
        );

        if (existing.length === 0) {
            const hash = await bcrypt.hash(config.admin.password, 10);
            await connection.query(
                'INSERT INTO usuarios (nombre, email, contrasena, rol) VALUES (?, ?, ?, ?)',
                [config.admin.name, normalizedEmail, hash, 'admin']
            );
            console.log(`Usuario administrador creado: ${normalizedEmail}`);
        } else {
            console.log('El usuario administrador ya existe.');
        }

        console.log('Base de datos inicializada correctamente.');
    } finally {
        if (connection) await connection.end();
    }
}

initDatabase().catch((error) => {
    console.error('Error al inicializar la base de datos:', error.message);
    process.exit(1);
});
