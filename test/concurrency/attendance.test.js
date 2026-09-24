const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
    configureTestEnvironment,
    createTestDatabase,
    dropTestDatabase,
    resetFixtures,
    HttpTestClient,
    listen,
    closeServer
} = require('../helpers/test-environment');

const environment = configureTestEnvironment('concurrency');
let pool;
let server;
let baseUrl;
let employeeId;
let Asistencia;

before(async () => {
    await createTestDatabase(environment);
    const app = require('../../app');
    pool = require('../../database/connection');
    Asistencia = require('../../models/Asistencia');
    ({ employeeId } = await resetFixtures(pool));
    ({ server, baseUrl } = await listen(app));
});

after(async () => {
    if (server) await closeServer(server);
    if (pool) await pool.end();
    await dropTestDatabase(environment);
});

test('ocho operaciones simultáneas guardan una sola entrada y una sola salida', async () => {
    const employee = new HttpTestClient(baseUrl);
    const login = await employee.login('empleado@test.local', 'Empleado12345');
    assert.equal(login.status, 200);

    const entryResponses = await Promise.all(
        Array.from({ length: 8 }, () => employee.request('/api/attendance/mark', {
            method: 'POST',
            body: { tipo: 'entrada' }
        }))
    );
    assert.equal(entryResponses.filter((response) => response.status === 201).length, 1);
    assert.equal(entryResponses.filter((response) => response.status === 409).length, 7);

    await pool.query(
        'UPDATE asistencia SET fecha_hora = ? WHERE usuario_id = ? AND tipo = ?',
        ['2026-09-20 08:00:00', employeeId, 'entrada']
    );

    const exitResults = await Promise.allSettled(
        Array.from({ length: 8 }, () => Asistencia.registrar(employeeId, 'salida', {
            date: '2026-09-20',
            time: '17:00:00',
            dateTime: '2026-09-20 17:00:00'
        }))
    );
    assert.equal(exitResults.filter((result) => result.status === 'fulfilled').length, 1);
    const rejectedExits = exitResults.filter((result) => result.status === 'rejected');
    assert.equal(rejectedExits.length, 7);
    rejectedExits.forEach((result) => {
        assert.equal(result.reason.statusCode, 409);
    });

    const [[counts]] = await pool.query(`
        SELECT
            SUM(tipo = 'entrada') AS entradas,
            SUM(tipo = 'salida') AS salidas
        FROM asistencia
        WHERE usuario_id = ?
    `, [employeeId]);
    assert.equal(Number(counts.entradas), 1);
    assert.equal(Number(counts.salidas), 1);
});
