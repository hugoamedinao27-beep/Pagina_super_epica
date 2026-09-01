const pool = require('../database/connection');

class Asistencia {
    constructor(id, usuario_id, tipo, fecha_hora) {
        this.id = id;
        this.usuario_id = usuario_id;
        this.tipo = tipo;
        this.fecha_hora = fecha_hora;
    }

    // CA-01: Registrar Asistencia
    static async registrar(usuario_id, tipo) {
        const now = new Date();
        const fechaHora = now.toISOString().slice(0, 19).replace('T', ' ');
        await pool.query(
            'INSERT INTO asistencia (usuario_id, tipo, fecha_hora) VALUES (?, ?, ?)',
            [usuario_id, tipo, fechaHora]
        );
        return fechaHora;
    }
}

module.exports = Asistencia;