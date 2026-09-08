const express = require('express');
const pool = require('../database/connection');
const asyncHandler = require('../middleware/async-handler');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAdmin);

router.get('/late', asyncHandler(async (req, res) => {
    const { fecha } = req.query;
    const [rows] = await pool.query(`
        SELECT u.id, u.nombre, u.email, a.fecha_hora, TIME(a.fecha_hora) AS hora_llegada
        FROM asistencia a JOIN usuarios u ON a.usuario_id = u.id
        WHERE a.tipo = 'entrada' AND DATE(a.fecha_hora) = ? AND TIME(a.fecha_hora) > '09:30:00'
        ORDER BY a.fecha_hora
    `, [fecha]);

    res.json(rows);
}));

router.get('/early', asyncHandler(async (req, res) => {
    const { fecha } = req.query;
    const [rows] = await pool.query(`
        SELECT u.id, u.nombre, u.email, a.fecha_hora, TIME(a.fecha_hora) AS hora_salida
        FROM asistencia a JOIN usuarios u ON a.usuario_id = u.id
        WHERE a.tipo = 'salida' AND DATE(a.fecha_hora) = ? AND TIME(a.fecha_hora) < '17:30:00'
        ORDER BY a.fecha_hora
    `, [fecha]);

    res.json(rows);
}));

router.get('/absent', asyncHandler(async (req, res) => {
    const { fecha } = req.query;
    const [rows] = await pool.query(`
        SELECT u.id, u.nombre, u.email
        FROM usuarios u
        WHERE u.activo = TRUE AND u.id NOT IN (
            SELECT DISTINCT usuario_id FROM asistencia WHERE DATE(fecha_hora) = ?
        )
        ORDER BY u.nombre
    `, [fecha]);

    res.json(rows);
}));

module.exports = router;
