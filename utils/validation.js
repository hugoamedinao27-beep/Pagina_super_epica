const ApplicationError = require('./application-error');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_PATTERN = /^[\p{L}\p{M} .'-]+$/u;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ALLOWED_ROLES = new Set(['admin', 'empleado']);
const ALLOWED_ATTENDANCE_TYPES = new Set(['entrada', 'salida']);

/**
 * Las funciones de este módulo validan datos no confiables antes de enviarlos
 * a los modelos. Devuelven el valor normalizado o lanzan ApplicationError 400.
 */

/** @returns {number} Identificador entero positivo. */
function validateId(value, fieldName = 'id') {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new ApplicationError(400, `${fieldName} debe ser un entero positivo.`, 'INVALID_ID');
    }
    return id;
}

/** @returns {string} Nombre sin espacios repetidos al inicio, final o interior. */
function validateName(value) {
    if (typeof value !== 'string') {
        throw new ApplicationError(400, 'El nombre es obligatorio.', 'INVALID_NAME');
    }

    const name = value.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 100 || !NAME_PATTERN.test(name)) {
        throw new ApplicationError(
            400,
            'El nombre debe tener entre 2 y 100 caracteres y contener solo letras, espacios, puntos, apóstrofes o guiones.',
            'INVALID_NAME'
        );
    }
    return name;
}

/** @returns {string} Correo normalizado en minúsculas. */
function validateEmail(value) {
    if (typeof value !== 'string') {
        throw new ApplicationError(400, 'El correo es obligatorio.', 'INVALID_EMAIL');
    }

    const email = value.trim().toLowerCase();
    if (email.length > 100 || !EMAIL_PATTERN.test(email)) {
        throw new ApplicationError(400, 'El correo electrónico no es válido.', 'INVALID_EMAIL');
    }
    return email;
}

/**
 * Valida la política de contraseña y el límite de 72 bytes de bcrypt.
 * @returns {string|null} Contraseña original o null cuando el cambio es opcional.
 */
function validatePassword(value, { required = true } = {}) {
    if (!required && (value === undefined || value === null || value === '')) return null;
    if (typeof value !== 'string') {
        throw new ApplicationError(400, 'La contraseña es obligatoria.', 'INVALID_PASSWORD');
    }

    const byteLength = Buffer.byteLength(value, 'utf8');
    if (value.length < 8 || byteLength > 72 || !/[\p{L}]/u.test(value) || !/\d/.test(value)) {
        throw new ApplicationError(
            400,
            'La contraseña debe tener al menos 8 caracteres, incluir una letra y un número, y no superar 72 bytes.',
            'INVALID_PASSWORD'
        );
    }
    return value;
}

/** @returns {'admin'|'empleado'} Rol permitido. */
function validateRole(value) {
    if (!ALLOWED_ROLES.has(value)) {
        throw new ApplicationError(400, 'El rol debe ser admin o empleado.', 'INVALID_ROLE');
    }
    return value;
}

/** @returns {'entrada'|'salida'} Tipo de marcación permitido. */
function validateAttendanceType(value) {
    if (!ALLOWED_ATTENDANCE_TYPES.has(value)) {
        throw new ApplicationError(400, 'El tipo debe ser entrada o salida.', 'INVALID_ATTENDANCE_TYPE');
    }
    return value;
}

/** @returns {string} Fecha real en formato AAAA-MM-DD. */
function validateDate(value) {
    if (typeof value !== 'string') {
        throw new ApplicationError(400, 'La fecha es obligatoria.', 'INVALID_DATE');
    }

    const match = DATE_PATTERN.exec(value);
    if (!match) {
        throw new ApplicationError(400, 'La fecha debe usar el formato AAAA-MM-DD.', 'INVALID_DATE');
    }

    const [, year, month, day] = match;
    const candidate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    const isRealDate = candidate.getUTCFullYear() === Number(year)
        && candidate.getUTCMonth() === Number(month) - 1
        && candidate.getUTCDate() === Number(day);

    if (!isRealDate) {
        throw new ApplicationError(400, 'La fecha indicada no existe.', 'INVALID_DATE');
    }

    return value;
}

/**
 * Valida los parámetros usados por los listados paginados.
 * El límite máximo evita respuestas excesivamente grandes.
 */
function validatePagination(pageValue, pageSizeValue) {
    const page = pageValue === undefined
        ? 1
        : validateId(pageValue, 'La página');
    const pageSize = pageSizeValue === undefined
        ? 25
        : validateId(pageSizeValue, 'El límite');

    if (pageSize > 100) {
        throw new ApplicationError(
            400,
            'El límite no puede superar 100 resultados por página.',
            'INVALID_PAGE_SIZE'
        );
    }

    return { page, pageSize };
}

module.exports = {
    validateId,
    validateName,
    validateEmail,
    validatePassword,
    validateRole,
    validateAttendanceType,
    validateDate,
    validatePagination
};
