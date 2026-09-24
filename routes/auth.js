const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../database/connection');
const config = require('../config/environment');
const asyncHandler = require('../middleware/async-handler');
const { requireAuth } = require('../middleware/auth');
const { validateEmail } = require('../utils/validation');

const router = express.Router();

/** Regenera el identificador de sesión para evitar fijación de sesión al ingresar. */
function regenerateSession(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((error) => error ? reject(error) : resolve());
    });
}

/** Fuerza el guardado de la sesión antes de responder al inicio de sesión. */
function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((error) => error ? reject(error) : resolve());
    });
}

/** Elimina del servidor la sesión asociada a la solicitud. */
function destroySession(req) {
    return new Promise((resolve, reject) => {
        req.session.destroy((error) => error ? reject(error) : resolve());
    });
}

/**
 * POST /api/login
 * Autentica una cuenta activa mediante correo y contraseña.
 * Body: { email: string, contrasena: string }.
 * Responde 200 con el usuario público o 401 cuando las credenciales no coinciden.
 */
router.post('/login', asyncHandler(async (req, res) => {
    const emailValue = typeof req.body.email === 'string' ? req.body.email : '';
    const contrasena = typeof req.body.contrasena === 'string' ? req.body.contrasena : '';

    if (!emailValue || !contrasena) {
        return res.status(400).json({ success: false, message: 'Correo y contraseña son obligatorios.' });
    }

    const email = validateEmail(emailValue);

    const [rows] = await pool.query(
        'SELECT id, nombre, email, contrasena, rol FROM usuarios WHERE email = ? AND activo = TRUE',
        [email]
    );
    const user = rows[0];
    const validPassword = user ? await bcrypt.compare(contrasena, user.contrasena) : false;

    if (!user || !validPassword) {
        return res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos.' });
    }

    await regenerateSession(req);
    req.session.user = { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
    await saveSession(req);

    return res.json({ success: true, user: req.session.user });
}));

/** POST /api/logout: destruye la sesión actual y elimina su cookie. */
router.post('/logout', asyncHandler(async (req, res) => {
    await destroySession(req);
    res.clearCookie(config.session.name);
    return res.json({ success: true });
}));

/** GET /api/current-user: devuelve el usuario activo de la sesión autenticada. */
router.get('/current-user', requireAuth, (req, res) => {
    res.json(req.session.user);
});

module.exports = router;
