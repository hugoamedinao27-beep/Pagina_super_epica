const ApplicationError = require('../utils/application-error');

/** Indica si MySQL está apagado, perdió la conexión o agotó el tiempo de espera. */
function isDatabaseUnavailable(error) {
    return ['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT'].includes(error.code);
}

/** Devuelve errores 404 en JSON para la API y texto para páginas web. */
function notFoundHandler(req, res) {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, message: 'Recurso no encontrado.' });
    }

    return res.status(404).send('Página no encontrada.');
}

/**
 * Punto único de traducción de errores a respuestas HTTP.
 * Los errores inesperados se registran en servidor sin filtrar detalles al cliente.
 */
function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);

    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, message: 'El cuerpo JSON de la solicitud es inválido.' });
    }

    if (error instanceof ApplicationError) {
        return res.status(error.statusCode).json({
            success: false,
            message: error.message,
            code: error.code
        });
    }

    if (isDatabaseUnavailable(error)) {
        return res.status(503).json({
            success: false,
            message: 'La base de datos no está disponible. Verifique que MySQL esté iniciado.'
        });
    }

    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'El registro ya existe.' });
    }

    console.error(`[${req.method} ${req.originalUrl}]`, error);

    return res.status(500).json({ success: false, message: 'Ocurrió un error interno.' });
}

module.exports = { notFoundHandler, errorHandler };
