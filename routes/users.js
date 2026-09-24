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

// Todas las operaciones de este módulo requieren un administrador activo.
router.use(requireAdmin);

/** GET /api/users: lista usuarios sin exponer hashes de contraseña. */
router.get('/', asyncHandler(async (req, res) => {
    res.json(await Usuario.listar());
}));

/**
 * POST /api/users
 * Crea una cuenta después de validar nombre, correo, contraseña y rol.
 * Responde 201 con los datos públicos del usuario creado.
 */
router.post('/', asyncHandler(async (req, res) => {
    const user = await Usuario.crear({
        nombre: validateName(req.body.nombre),
        email: validateEmail(req.body.email),
        contrasena: validatePassword(req.body.contrasena),
        rol: validateRole(req.body.rol || 'empleado')
    });

    res.status(201).json({ success: true, user });
}));

/**
 * PUT /api/users/:id
 * Actualiza una cuenta. Una contraseña vacía conserva el hash existente.
 */
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

/**
 * PUT /api/users/:id/deactivate
 * Realiza una eliminación lógica para conservar el historial de asistencia.
 */
router.put('/:id/deactivate', asyncHandler(async (req, res) => {
    const id = validateId(req.params.id, 'El identificador del usuario');
    const user = await Usuario.cambiarEstado(req.session.user.id, id, false);
    res.json({ success: true, user });
}));

/** PUT /api/users/:id/activate: habilita nuevamente una cuenta existente. */
router.put('/:id/activate', asyncHandler(async (req, res) => {
    const id = validateId(req.params.id, 'El identificador del usuario');
    const user = await Usuario.cambiarEstado(req.session.user.id, id, true);
    res.json({ success: true, user });
}));

module.exports = router;
