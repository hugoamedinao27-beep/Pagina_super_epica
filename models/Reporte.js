const pool = require('../database/connection');

/**
 * Consultas de solo lectura para los reportes administrativos.
 * Reciben fechas ya validadas y comparan horarios inclusivos según las reglas:
 * 09:30 es puntual y 17:30 no es una salida anticipada.
 */
class Reporte {
    /** @returns {Promise<object>} Entradas posteriores a las 09:30 y paginación. */
    static async atrasos(fecha, pagination) {
        const [[countRow]] = await pool.query(`
            SELECT COUNT(*) AS total
            FROM asistencia a
            JOIN usuarios u ON a.usuario_id = u.id
            WHERE u.rol = 'empleado'
              AND a.tipo = 'entrada'
              AND a.fecha = ?
              AND TIME(a.fecha_hora) > '09:30:00'
        `, [fecha]);
        const pageInfo = this.#buildPageInfo(countRow.total, pagination);
        const [items] = await pool.query(`
            SELECT u.id, u.nombre, u.email, a.fecha, a.fecha_hora,
                   TIME_FORMAT(TIME(a.fecha_hora), '%H:%i:%s') AS hora_llegada
            FROM asistencia a
            JOIN usuarios u ON a.usuario_id = u.id
            WHERE u.rol = 'empleado'
              AND a.tipo = 'entrada'
              AND a.fecha = ?
              AND TIME(a.fecha_hora) > '09:30:00'
            ORDER BY a.fecha_hora, u.id
            LIMIT ? OFFSET ?
        `, [fecha, pageInfo.pageSize, pageInfo.offset]);
        return this.#createResult(items, pageInfo);
    }

    /** @returns {Promise<object>} Salidas anteriores a las 17:30 y paginación. */
    static async salidasAnticipadas(fecha, pagination) {
        const [[countRow]] = await pool.query(`
            SELECT COUNT(*) AS total
            FROM asistencia a
            JOIN usuarios u ON a.usuario_id = u.id
            WHERE u.rol = 'empleado'
              AND a.tipo = 'salida'
              AND a.fecha = ?
              AND TIME(a.fecha_hora) < '17:30:00'
        `, [fecha]);
        const pageInfo = this.#buildPageInfo(countRow.total, pagination);
        const [items] = await pool.query(`
            SELECT u.id, u.nombre, u.email, a.fecha, a.fecha_hora,
                   TIME_FORMAT(TIME(a.fecha_hora), '%H:%i:%s') AS hora_salida
            FROM asistencia a
            JOIN usuarios u ON a.usuario_id = u.id
            WHERE u.rol = 'empleado'
              AND a.tipo = 'salida'
              AND a.fecha = ?
              AND TIME(a.fecha_hora) < '17:30:00'
            ORDER BY a.fecha_hora, u.id
            LIMIT ? OFFSET ?
        `, [fecha, pageInfo.pageSize, pageInfo.offset]);
        return this.#createResult(items, pageInfo);
    }

    /** @returns {Promise<object>} Empleados activos sin marcaciones y paginación. */
    static async inasistencias(fecha, pagination) {
        const [[countRow]] = await pool.query(`
            SELECT COUNT(*) AS total
            FROM usuarios u
            WHERE u.activo = TRUE
              AND u.rol = 'empleado'
              AND NOT EXISTS (
                  SELECT 1
                  FROM asistencia a
                  WHERE a.usuario_id = u.id AND a.fecha = ?
              )
        `, [fecha]);
        const pageInfo = this.#buildPageInfo(countRow.total, pagination);
        const [items] = await pool.query(`
            SELECT u.id, u.nombre, u.email
            FROM usuarios u
            WHERE u.activo = TRUE
              AND u.rol = 'empleado'
              AND NOT EXISTS (
                  SELECT 1
                  FROM asistencia a
                  WHERE a.usuario_id = u.id AND a.fecha = ?
              )
            ORDER BY u.nombre, u.id
            LIMIT ? OFFSET ?
        `, [fecha, pageInfo.pageSize, pageInfo.offset]);
        return this.#createResult(items, pageInfo);
    }

    /** Calcula una página válida y su desplazamiento a partir del total encontrado. */
    static #buildPageInfo(totalValue, { page, pageSize }) {
        const total = Number(totalValue);
        const totalPages = Math.ceil(total / pageSize);
        const currentPage = totalPages === 0 ? 1 : Math.min(page, totalPages);

        return {
            page: currentPage,
            pageSize,
            total,
            totalPages,
            offset: (currentPage - 1) * pageSize
        };
    }

    /** Mantiene un formato uniforme de respuesta para todos los reportes. */
    static #createResult(items, pageInfo) {
        return {
            items,
            pagination: {
                page: pageInfo.page,
                pageSize: pageInfo.pageSize,
                total: pageInfo.total,
                totalPages: pageInfo.totalPages
            }
        };
    }
}

module.exports = Reporte;
