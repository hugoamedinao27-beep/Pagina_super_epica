/**
 * Entrega los rechazos de una ruta asíncrona al manejador central de Express.
 * Express 4 no captura automáticamente los rechazos de promesas.
 */
function asyncHandler(handler) {
    return function wrappedHandler(req, res, next) {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}

module.exports = asyncHandler;
