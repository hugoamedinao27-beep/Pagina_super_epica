const express = require('express');
const Reporte = require('../models/Reporte');
const asyncHandler = require('../middleware/async-handler');
const { requireAdmin } = require('../middleware/auth');
const { validateDate, validatePagination } = require('../utils/validation');

const router = express.Router();

// Los reportes contienen información de personal y solo son visibles para admins.
router.use(requireAdmin);

/**
 * Valida los filtros comunes de los reportes.
 * @returns {{fecha: string, pagination: {page: number, pageSize: number}}}
 */
function readReportFilters(req) {
    return {
        fecha: validateDate(req.query.fecha),
        pagination: validatePagination(req.query.pagina, req.query.limite)
    };
}

/** GET /api/reports/late: entradas posteriores a las 09:30, paginadas. */
router.get('/late', asyncHandler(async (req, res) => {
    const { fecha, pagination } = readReportFilters(req);
    res.json(await Reporte.atrasos(fecha, pagination));
}));

/** GET /api/reports/early: salidas anteriores a las 17:30, paginadas. */
router.get('/early', asyncHandler(async (req, res) => {
    const { fecha, pagination } = readReportFilters(req);
    res.json(await Reporte.salidasAnticipadas(fecha, pagination));
}));

/** GET /api/reports/absent: empleados activos sin marcaciones, paginados. */
router.get('/absent', asyncHandler(async (req, res) => {
    const { fecha, pagination } = readReportFilters(req);
    res.json(await Reporte.inasistencias(fecha, pagination));
}));

module.exports = router;
