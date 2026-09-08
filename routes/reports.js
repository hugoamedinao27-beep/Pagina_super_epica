const express = require('express');
const Reporte = require('../models/Reporte');
const asyncHandler = require('../middleware/async-handler');
const { requireAdmin } = require('../middleware/auth');
const { validateDate } = require('../utils/validation');

const router = express.Router();

router.use(requireAdmin);

router.get('/late', asyncHandler(async (req, res) => {
    const fecha = validateDate(req.query.fecha);
    res.json(await Reporte.atrasos(fecha));
}));

router.get('/early', asyncHandler(async (req, res) => {
    const fecha = validateDate(req.query.fecha);
    res.json(await Reporte.salidasAnticipadas(fecha));
}));

router.get('/absent', asyncHandler(async (req, res) => {
    const fecha = validateDate(req.query.fecha);
    res.json(await Reporte.inasistencias(fecha));
}));

module.exports = router;
