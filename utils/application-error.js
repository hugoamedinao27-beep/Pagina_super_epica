class ApplicationError extends Error {
    constructor(statusCode, message, code = 'APPLICATION_ERROR') {
        super(message);
        this.name = 'ApplicationError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

module.exports = ApplicationError;
