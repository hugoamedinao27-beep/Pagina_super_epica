const pool = require('../database/connection');

/**
 * Consultas de solo lectura para los reportes administrativos.
 * Reciben fechas ya validadas y comparan horarios inclusivos según las reglas:
 * 09:30 es puntual y 17:30 no es una salida anticipada.
 */
class Reporte {
    /** @returns {Promise<Array>} Entradas posteriores a las 09:30. */
    static async atrasos(fecha) {
        const [rows] = await pool.query(`
            SELECT u.id, u.nombre, u.email, a.fecha, a.fecha_hora,
                   TIME_FORMAT(TIME(a.fecha_hora), '%H:%i:%s') AS hora_llegada
            FROM asistencia a
            JOIN usuarios u ON a.usuario_id = u.id
            WHERE u.rol = 'empleado'
              AND a.tipo = 'entrada'
              AND a.fecha = ?
              AND TIME(a.fecha_hora) > '09:30:00'
            ORDER BY a.fecha_hora
        `, [fecha]);
        return rows;
    }

    /** @returns {Promise<Array>} Salidas anteriores a las 17:30. */
    static async salidasAnticipadas(fecha) {
        const [rows] = await pool.query(`
            SELECT u.id, u.nombre, u.email, a.fecha, a.fecha_hora,
                   TIME_FORMAT(TIME(a.fecha_hora), '%H:%i:%s') AS hora_salida
            FROM asistencia a
            JOIN usuarios u ON a.usuario_id = u.id
            WHERE u.rol = 'empleado'
              AND a.tipo = 'salida'
              AND a.fecha = ?
              AND TIME(a.fecha_hora) < '17:30:00'
            ORDER BY a.fecha_hora
        `, [fecha]);
        return rows;
    }

    /** @returns {Promise<Array>} Empleados activos sin marcaciones ese día. */
    static async inasistencias(fecha) {
        const [rows] = await pool.query(`
            SELECT u.id, u.nombre, u.email
            FROM usuarios u
            WHERE u.activo = TRUE
              AND u.rol = 'empleado'
              AND NOT EXISTS (
                  SELECT 1
                  FROM asistencia a
                  WHERE a.usuario_id = u.id AND a.fecha = ?
              )
            ORDER BY u.nombre
        `, [fecha]);
        return rows;
    }
}

module.exports = Reporte;
