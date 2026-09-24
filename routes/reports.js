const express = require('express');
const Reporte = require('../models/Reporte');
const asyncHandler = require('../middleware/async-handler');
const { requireAdmin } = require('../middleware/auth');
const { validateDate, validatePagination } = require('../utils/validation');

const router = express.Router();

router.use(requireAdmin);

function readReportFilters(req) {
    return {
        fecha: validateDate(req.query.fecha),
        pagination: validatePagination(req.query.pagina, req.query.limite)
    };
}

router.get('/late', asyncHandler(async (req, res) => {
    const { fecha, pagination } = readReportFilters(req);
    res.json(await Reporte.atrasos(fecha, pagination));
}));

router.get('/early', asyncHandler(async (req, res) => {
    const { fecha, pagination } = readReportFilters(req);
    res.json(await Reporte.salidasAnticipadas(fecha, pagination));
}));

router.get('/absent', asyncHandler(async (req, res) => {
    const { fecha, pagination } = readReportFilters(req);
    res.json(await Reporte.inasistencias(fecha, pagination));
}));

module.exports = router;
