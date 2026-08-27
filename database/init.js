const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function initDatabase() {
    console.log('Inicializando base de datos...');

    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Hamo1010'
    });

    await connection.query('CREATE DATABASE IF NOT EXISTS tienda_super_wai');
    await connection.query('USE tienda_super_wai');

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

    const [existing] = await connection.query('SELECT id FROM usuarios WHERE email = ?', ['admin@tienda.com']);
    if (existing.length === 0) {
        const hash = await bcrypt.hash('admin123', 10);
        await connection.query(
            'INSERT INTO usuarios (nombre, email, contrasena, rol) VALUES (?, ?, ?, ?)',
            ['Administrador', 'admin@tienda.com', hash, 'admin']
        );
        console.log('Usuario administrador creado: admin@tienda.com / admin123');
    } else {
        console.log('Usuario administrador ya existe.');
    }

    await connection.end();
    console.log('Base de datos inicializada correctamente.');
}

initDatabase().catch(err => {
    console.error('Error al inicializar la base de datos:', err);
    process.exit(1);
});
