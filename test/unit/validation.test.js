const test = require('node:test');
const assert = require('node:assert/strict');
const {
    validateId,
    validateName,
    validateEmail,
    validatePassword,
    validateRole,
    validateAttendanceType,
    validateDate
} = require('../../utils/validation');

function assertValidationError(callback, expectedCode) {
    assert.throws(callback, (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, expectedCode);
        return true;
    });
}

test('normaliza identificadores, nombres y correos válidos', () => {
    assert.equal(validateId('25'), 25);
    assert.equal(validateName("  Ana   O'Connor  "), "Ana O'Connor");
    assert.equal(validateEmail('  ANA@EJEMPLO.CL '), 'ana@ejemplo.cl');
});

test('rechaza identificadores y nombres inválidos', () => {
    for (const value of [0, -1, 1.5, 'abc', Number.MAX_SAFE_INTEGER + 1]) {
        assertValidationError(() => validateId(value), 'INVALID_ID');
    }
    for (const value of ['', 'A', 'Usuario 123', '<script>']) {
        assertValidationError(() => validateName(value), 'INVALID_NAME');
    }
});

test('valida correos y contraseñas con las reglas de seguridad', () => {
    assert.equal(validatePassword('Clave12345'), 'Clave12345');
    assert.equal(validatePassword('', { required: false }), null);

    for (const value of ['', 'sinnumero', '12345678', 'A1']) {
        assertValidationError(() => validatePassword(value), 'INVALID_PASSWORD');
    }
    assertValidationError(() => validateEmail('correo-sin-dominio'), 'INVALID_EMAIL');
});

test('solo acepta roles y tipos de asistencia conocidos', () => {
    assert.equal(validateRole('admin'), 'admin');
    assert.equal(validateRole('empleado'), 'empleado');
    assert.equal(validateAttendanceType('entrada'), 'entrada');
    assert.equal(validateAttendanceType('salida'), 'salida');
    assertValidationError(() => validateRole('superadmin'), 'INVALID_ROLE');
    assertValidationError(() => validateAttendanceType('pausa'), 'INVALID_ATTENDANCE_TYPE');
});

test('acepta fechas reales y rechaza formatos o días imposibles', () => {
    assert.equal(validateDate('2028-02-29'), '2028-02-29');
    for (const value of ['2026-02-29', '2026-13-01', '23-09-2026', '2026/09/23']) {
        assertValidationError(() => validateDate(value), 'INVALID_DATE');
    }
});
