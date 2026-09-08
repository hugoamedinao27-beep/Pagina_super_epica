const express = require('express');
const Usuario = require('../models/Usuario');
const asyncHandler = require('../middleware/async-handler');
const { requireAdmin } = require('../middleware/auth');
const {
    validateId,
    validateName,
    validateEmail,
    validatePassword,
    validateRole
} = require('../utils/validation');

const router = express.Router();

router.use(requireAdmin);

router.get('/', asyncHandler(async (req, res) => {
    res.json(await Usuario.listar());
}));

router.post('/', asyncHandler(async (req, res) => {
    const user = await Usuario.crear({
        nombre: validateName(req.body.nombre),
        email: validateEmail(req.body.email),
        contrasena: validatePassword(req.body.contrasena),
        rol: validateRole(req.body.rol || 'empleado')
    });

    res.status(201).json({ success: true, user });
}));

router.put('/:id', asyncHandler(async (req, res) => {
    const id = validateId(req.params.id, 'El identificador del usuario');
    const user = await Usuario.modificar(req.session.user.id, id, {
        nombre: validateName(req.body.nombre),
        email: validateEmail(req.body.email),
        contrasena: validatePassword(req.body.contrasena, { required: false }),
        rol: validateRole(req.body.rol)
    });

    res.json({ success: true, user });
}));

router.put('/:id/deactivate', asyncHandler(async (req, res) => {
    const id = validateId(req.params.id, 'El identificador del usuario');
    const user = await Usuario.cambiarEstado(req.session.user.id, id, false);
    res.json({ success: true, user });
}));

router.put('/:id/activate', asyncHandler(async (req, res) => {
    const id = validateId(req.params.id, 'El identificador del usuario');
    const user = await Usuario.cambiarEstado(req.session.user.id, id, true);
    res.json({ success: true, user });
}));

module.exports = router;
