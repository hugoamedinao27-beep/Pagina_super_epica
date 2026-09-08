const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../database/connection');
const asyncHandler = require('../middleware/async-handler');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAdmin);

router.get('/', asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
        'SELECT id, nombre, email, rol, activo, creado_en FROM usuarios ORDER BY nombre'
    );
    res.json(rows);
}));

router.post('/', asyncHandler(async (req, res) => {
    const { nombre, email, contrasena, rol } = req.body;
    const hash = await bcrypt.hash(contrasena, 10);
    await pool.query(
        'INSERT INTO usuarios (nombre, email, contrasena, rol) VALUES (?, ?, ?, ?)',
        [nombre, email, hash, rol || 'empleado']
    );
    res.status(201).json({ success: true });
}));

router.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { nombre, email, contrasena, rol } = req.body;

    if (contrasena) {
        const hash = await bcrypt.hash(contrasena, 10);
        await pool.query(
            'UPDATE usuarios SET nombre = ?, email = ?, contrasena = ?, rol = ? WHERE id = ?',
            [nombre, email, hash, rol, id]
        );
    } else {
        await pool.query(
            'UPDATE usuarios SET nombre = ?, email = ?, rol = ? WHERE id = ?',
            [nombre, email, rol, id]
        );
    }

    res.json({ success: true });
}));

router.put('/:id/deactivate', asyncHandler(async (req, res) => {
    await pool.query('UPDATE usuarios SET activo = FALSE WHERE id = ?', [req.params.id]);
    res.json({ success: true });
}));

router.put('/:id/activate', asyncHandler(async (req, res) => {
    await pool.query('UPDATE usuarios SET activo = TRUE WHERE id = ?', [req.params.id]);
    res.json({ success: true });
}));

module.exports = router;
