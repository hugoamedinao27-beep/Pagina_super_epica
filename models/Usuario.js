const pool = require('../database/connection');
const bcrypt = require('bcryptjs');

class Usuario {
    constructor(id, nombre, email, rol, activo) {
        this.id = id;
        this.nombre = nombre;
        this.email = email;
        this.rol = rol;
        this.activo = activo;
    }

    // GU-01: Crear Usuario
    static async crear(nombre, email, contrasena, rol = 'empleado') {
        const hash = await bcrypt.hash(contrasena, 10);
        const [result] = await pool.query(
            'INSERT INTO usuarios (nombre, email, contrasena, rol) VALUES (?, ?, ?, ?)', 
            [nombre, email, hash, rol]
        );
        return result.insertId;
    }

    // GU-02: Modificar Usuario
    static async modificar(id, nombre, email, rol, contrasena = null) {
        if (contrasena) {
            const hash = await bcrypt.hash(contrasena, 10);
            await pool.query('UPDATE usuarios SET nombre = ?, email = ?, contrasena = ?, rol = ? WHERE id = ?', [nombre, email, hash, rol, id]);
        } else {
            await pool.query('UPDATE usuarios SET nombre = ?, email = ?, rol = ? WHERE id = ?', [nombre, email, rol, id]);
        }
        return true;
    }

    // GU-03: Eliminar (Desactivar) Usuario
    static async eliminar(id) {
        await pool.query('UPDATE usuarios SET activo = FALSE WHERE id = ?', [id]);
        return true;
    }
}

module.exports = Usuario;