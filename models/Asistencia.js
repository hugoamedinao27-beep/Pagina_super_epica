const pool = require('../database/connection');
const ApplicationError = require('../utils/application-error');

class Asistencia {
    /**
     * Registra una marcación dentro de una transacción. El bloqueo de la fila del
     * usuario serializa las solicitudes concurrentes para una misma persona.
     */
    static async registrar(usuarioId, tipo, businessDateTime) {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [users] = await connection.query(
                'SELECT id, rol FROM usuarios WHERE id = ? AND activo = TRUE FOR UPDATE',
                [usuarioId]
            );

            if (users.length === 0) {
                throw new ApplicationError(401, 'El usuario ya no está activo.', 'INACTIVE_USER');
            }
            if (users[0].rol !== 'empleado') {
                throw new ApplicationError(403, 'Solo los empleados pueden marcar asistencia.', 'INVALID_ATTENDANCE_ROLE');
            }

            const [records] = await connection.query(
                'SELECT tipo, fecha_hora FROM asistencia WHERE usuario_id = ? AND fecha = ? ORDER BY fecha_hora',
                [usuarioId, businessDateTime.date]
            );

            const entry = records.find((record) => record.tipo === 'entrada');
            const exit = records.find((record) => record.tipo === 'salida');

            if (tipo === 'entrada' && entry) {
                throw new ApplicationError(409, 'Ya registraste tu entrada el día de hoy.', 'DUPLICATE_ENTRY');
            }
            if (tipo === 'entrada' && exit) {
                throw new ApplicationError(409, 'La jornada de hoy ya fue cerrada.', 'CLOSED_WORKDAY');
            }
            if (tipo === 'salida' && !entry) {
                throw new ApplicationError(409, 'Debes registrar una entrada antes de marcar la salida.', 'MISSING_ENTRY');
            }
            if (tipo === 'salida' && exit) {
                throw new ApplicationError(409, 'Ya registraste tu salida el día de hoy.', 'DUPLICATE_EXIT');
            }

            if (tipo === 'salida') {
                const [differenceRows] = await connection.query(
                    'SELECT TIMESTAMPDIFF(SECOND, ?, ?) AS segundos',
                    [entry.fecha_hora, businessDateTime.dateTime]
                );

                if (differenceRows[0].segundos < 60) {
                    throw new ApplicationError(
                        409,
                        'Espera al menos 1 minuto después de la entrada antes de marcar la salida.',
                        'ATTENDANCE_TOO_SOON'
                    );
                }
            }

            await connection.query(
                'INSERT INTO asistencia (usuario_id, tipo, fecha_hora) VALUES (?, ?, ?)',
                [usuarioId, tipo, businessDateTime.dateTime]
            );

            await connection.commit();
            return { tipo, fecha_hora: businessDateTime.dateTime };
        } catch (error) {
            await connection.rollback();
            if (error.code === 'ER_DUP_ENTRY') {
                throw new ApplicationError(409, 'La marcación ya fue registrada.', 'DUPLICATE_ATTENDANCE');
            }
            throw error;
        } finally {
            connection.release();
        }
    }

    static async listarDelDia(usuarioId, fecha) {
        const [rows] = await pool.query(
            'SELECT tipo, fecha_hora, TIME_FORMAT(TIME(fecha_hora), ?) AS hora FROM asistencia WHERE usuario_id = ? AND fecha = ? ORDER BY fecha_hora',
            ['%H:%i:%s', usuarioId, fecha]
        );
        return rows;
    }
}

module.exports = Asistencia;
