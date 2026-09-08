const express = require('express');
const pool = require('../database/connection');
const asyncHandler = require('../middleware/async-handler');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/mark', requireAuth, asyncHandler(async (req, res) => {
    const { tipo } = req.body;
    const userId = req.session.user.id;

    if (!['entrada', 'salida'].includes(tipo)) {
        return res.status(400).json({ success: false, message: 'Tipo de marcación inválido.' });
    }

    const [registrosHoy] = await pool.query(
        'SELECT id FROM asistencia WHERE usuario_id = ? AND tipo = ? AND DATE(fecha_hora) = CURDATE()',
        [userId, tipo]
    );

    if (registrosHoy.length > 0) {
        return res.status(409).json({ success: false, message: `Ya registraste tu ${tipo} el día de hoy.` });
    }

    const [rows] = await pool.query(
        'SELECT TIMESTAMPDIFF(SECOND, fecha_hora, NOW()) AS segundos FROM asistencia WHERE usuario_id = ? ORDER BY id DESC LIMIT 1',
        [userId]
    );

    if (rows.length > 0 && rows[0].segundos >= 0 && rows[0].segundos < 60) {
        return res.status(409).json({
            success: false,
            message: 'Espera al menos 1 minuto antes de volver a marcar.'
        });
    }

    await pool.query(
        'INSERT INTO asistencia (usuario_id, tipo, fecha_hora) VALUES (?, ?, NOW())',
        [userId, tipo]
    );

    return res.status(201).json({
        success: true,
        message: `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} registrada.`
    });
}));

router.get('/status', requireAuth, asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
        'SELECT tipo, fecha_hora FROM asistencia WHERE usuario_id = ? AND DATE(fecha_hora) = CURDATE() ORDER BY fecha_hora',
        [req.session.user.id]
    );

    res.json({ records: rows });
}));

module.exports = router;
