const pool = require('../database/connection');
const bcrypt = require('bcryptjs');
const ApplicationError = require('../utils/application-error');

class Usuario {
    static async listar() {
        const [rows] = await pool.query(
            'SELECT id, nombre, email, rol, activo, creado_en FROM usuarios ORDER BY nombre'
        );
        return rows;
    }

    static async crear({ nombre, email, contrasena, rol }) {
        const hash = await bcrypt.hash(contrasena, 10);
        const [result] = await pool.query(
            'INSERT INTO usuarios (nombre, email, contrasena, rol) VALUES (?, ?, ?, ?)',
            [nombre, email, hash, rol]
        );

        return this.buscarPorId(result.insertId);
    }

    static async buscarPorId(id, connection = pool) {
        const [rows] = await connection.query(
            'SELECT id, nombre, email, rol, activo, creado_en FROM usuarios WHERE id = ?',
            [id]
        );
        return rows[0] || null;
    }

    static async modificar(actorId, id, { nombre, email, contrasena, rol }) {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();
            const target = await this.#bloquearUsuario(connection, id);

            if (actorId === id && target.rol === 'admin' && rol !== 'admin') {
                throw new ApplicationError(
                    409,
                    'No puedes quitarte a ti mismo el rol de administrador.',
                    'SELF_ADMIN_DEMOTION'
                );
            }

            if (target.activo && target.rol === 'admin' && rol !== 'admin') {
                await this.#assertAnotherActiveAdmin(connection, id);
            }

            if (contrasena) {
                const hash = await bcrypt.hash(contrasena, 10);
                await connection.query(
                    'UPDATE usuarios SET nombre = ?, email = ?, contrasena = ?, rol = ? WHERE id = ?',
                    [nombre, email, hash, rol, id]
                );
            } else {
                await connection.query(
                    'UPDATE usuarios SET nombre = ?, email = ?, rol = ? WHERE id = ?',
                    [nombre, email, rol, id]
                );
            }

            await connection.commit();
            return this.buscarPorId(id, connection);
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async cambiarEstado(actorId, id, activo) {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();
            const target = await this.#bloquearUsuario(connection, id);

            if (!activo && actorId === id) {
                throw new ApplicationError(
                    409,
                    'No puedes desactivar tu propia cuenta.',
                    'SELF_DEACTIVATION'
                );
            }

            if (!activo && target.rol === 'admin' && target.activo) {
                await this.#assertAnotherActiveAdmin(connection, id);
            }

            await connection.query('UPDATE usuarios SET activo = ? WHERE id = ?', [activo, id]);
            await connection.commit();
            return this.buscarPorId(id, connection);
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async #bloquearUsuario(connection, id) {
        const [rows] = await connection.query(
            'SELECT id, rol, activo FROM usuarios WHERE id = ? FOR UPDATE',
            [id]
        );

        if (rows.length === 0) {
            throw new ApplicationError(404, 'El usuario no existe.', 'USER_NOT_FOUND');
        }

        return rows[0];
    }

    static async #assertAnotherActiveAdmin(connection, excludedId) {
        const [admins] = await connection.query(
            'SELECT id FROM usuarios WHERE rol = ? AND activo = TRUE FOR UPDATE',
            ['admin']
        );

        if (!admins.some((admin) => admin.id !== excludedId)) {
            throw new ApplicationError(
                409,
                'Debe permanecer al menos un administrador activo.',
                'LAST_ACTIVE_ADMIN'
            );
        }
    }
}

module.exports = Usuario;
