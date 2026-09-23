const pool = require('../database/connection');

/**
 * Revalida la cuenta contra MySQL en cada solicitud. Esto hace efectivos de
 * inmediato los cambios de rol y las desactivaciones aunque exista una sesión.
 */
async function findActiveSessionUser(sessionUser) {
    if (!sessionUser?.id) return null;

    const [rows] = await pool.query(
        'SELECT id, nombre, email, rol FROM usuarios WHERE id = ? AND activo = TRUE',
        [sessionUser.id]
    );

    return rows[0] || null;
}

/** Actualiza la copia mínima del usuario almacenada en la sesión. */
async function refreshSessionUser(req) {
    const user = await findActiveSessionUser(req.session.user);
    if (!user) {
        req.session.user = null;
        return null;
    }

    req.session.user = user;
    return user;
}

/** Middleware JSON: exige una cuenta activa de cualquier rol. */
async function requireAuth(req, res, next) {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'No autenticado.' });
        }

        const user = await refreshSessionUser(req);
        if (!user) {
            return res.status(401).json({ success: false, message: 'La sesión ya no es válida.' });
        }

        next();
    } catch (error) {
        next(error);
    }
}

/** Middleware JSON: exige una cuenta activa con rol de administrador. */
async function requireAdmin(req, res, next) {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'No autenticado.' });
        }

        const user = await refreshSessionUser(req);
        if (!user) {
            return res.status(401).json({ success: false, message: 'La sesión ya no es válida.' });
        }

        if (user.rol !== 'admin') {
            return res.status(403).json({ success: false, message: 'Sin permisos de administrador.' });
        }

        next();
    } catch (error) {
        next(error);
    }
}

function requirePageAuth(req, res, next) {
    if (!req.session.user) return res.redirect('/');

    findActiveSessionUser(req.session.user)
        .then((user) => {
            if (!user) return res.redirect('/');
            req.session.user = user;
            next();
        })
        .catch(next);
}

function requireAdminPage(req, res, next) {
    if (!req.session.user) return res.redirect('/');

    findActiveSessionUser(req.session.user)
        .then((user) => {
            if (!user || user.rol !== 'admin') return res.redirect('/dashboard');
            req.session.user = user;
            next();
        })
        .catch(next);
}

module.exports = {
    requireAuth,
    requireAdmin,
    requirePageAuth,
    requireAdminPage
};
