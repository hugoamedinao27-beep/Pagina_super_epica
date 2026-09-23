/**
 * Error esperado de negocio o validación.
 * El manejador central usa `statusCode` y `code` para producir una respuesta
 * HTTP segura sin exponer detalles internos de MySQL o del servidor.
 */
class ApplicationError extends Error {
    /**
     * @param {number} statusCode Código HTTP que recibirá el cliente.
     * @param {string} message Mensaje comprensible para la persona usuaria.
     * @param {string} code Código estable que permite identificar el caso.
     */
    constructor(statusCode, message, code = 'APPLICATION_ERROR') {
        super(message);
        this.name = 'ApplicationError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

module.exports = ApplicationError;
