const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../database/connection');
const config = require('../config/environment');
const asyncHandler = require('../middleware/async-handler');
const { requireAuth } = require('../middleware/auth');
const { validateEmail } = require('../utils/validation');

const router = express.Router();

function regenerateSession(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((error) => error ? reject(error) : resolve());
    });
}

function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((error) => error ? reject(error) : resolve());
    });
}

function destroySession(req) {
    return new Promise((resolve, reject) => {
        req.session.destroy((error) => error ? reject(error) : resolve());
    });
}

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

router.post('/logout', asyncHandler(async (req, res) => {
    await destroySession(req);
    res.clearCookie(config.session.name);
    return res.json({ success: true });
}));

router.get('/current-user', requireAuth, (req, res) => {
    res.json(req.session.user);
});

module.exports = router;
