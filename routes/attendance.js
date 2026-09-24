const express = require('express');
const Asistencia = require('../models/Asistencia');
const asyncHandler = require('../middleware/async-handler');
const { requireAuth } = require('../middleware/auth');
const { validateAttendanceType } = require('../utils/validation');
const { getBusinessDateTime } = require('../utils/business-time');

const router = express.Router();

/**
 * POST /api/attendance/mark
 * Registra la entrada o salida del empleado autenticado.
 * Body: { tipo: 'entrada'|'salida' }.
 * Responde 201 o 409 cuando una regla de la jornada impide la marcación.
 */
router.post('/mark', requireAuth, asyncHandler(async (req, res) => {
    const tipo = validateAttendanceType(req.body.tipo);
    const mark = await Asistencia.registrar(
        req.session.user.id,
        tipo,
        getBusinessDateTime()
    );

    return res.status(201).json({
        success: true,
        message: `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} registrada.`,
        record: mark
    });
}));

/** GET /api/attendance/status: devuelve las marcaciones del día del usuario. */
router.get('/status', requireAuth, asyncHandler(async (req, res) => {
    const { date } = getBusinessDateTime();
    const records = await Asistencia.listarDelDia(req.session.user.id, date);
    res.json({ records });
}));

module.exports = router;
