const { describe, test, before, after, beforeEach } = require('node:test');
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

const environment = configureTestEnvironment('api');
let pool;
let server;
let baseUrl;
let fixtures;

describe('integración de la API', { concurrency: false }, () => {
    before(async () => {
        await createTestDatabase(environment);
        const app = require('../../app');
        pool = require('../../database/connection');
        ({ server, baseUrl } = await listen(app));
    });

    after(async () => {
        if (server) await closeServer(server);
        if (pool) await pool.end();
        await dropTestDatabase(environment);
    });

    beforeEach(async () => {
        fixtures = await resetFixtures(pool);
    });

    test('expone salud, protege páginas, cierra sesión y responde recursos inexistentes', async () => {
        const client = new HttpTestClient(baseUrl);

        const health = await client.request('/api/health');
        assert.equal(health.status, 200);
        assert.equal(health.body.status, 'ok');

        const protectedPage = await client.request('/dashboard', { redirect: 'manual' });
        assert.equal(protectedPage.status, 302);

        await client.login('admin@test.local', 'Admin12345');
        const adminPage = await client.request('/admin');
        assert.equal(adminPage.status, 200);

        const missing = await client.request('/api/no-existe');
        assert.equal(missing.status, 404);

        const logout = await client.request('/api/logout', { method: 'POST' });
        assert.equal(logout.status, 200);
        const expiredSession = await client.request('/api/current-user');
        assert.equal(expiredSession.status, 401);
    });

    test('protege las rutas privadas cuando no existe una sesión', async () => {
        const client = new HttpTestClient(baseUrl);

        const currentUser = await client.request('/api/current-user');
        const users = await client.request('/api/users');

        assert.equal(currentUser.status, 401);
        assert.equal(users.status, 401);
    });

    test('rechaza credenciales incorrectas y conserva una sesión válida', async () => {
        const client = new HttpTestClient(baseUrl);

        const rejected = await client.login('admin@test.local', 'ClaveIncorrecta1');
        assert.equal(rejected.status, 401);

        const accepted = await client.login('admin@test.local', 'Admin12345');
        assert.equal(accepted.status, 200);
        assert.equal(accepted.body.user.rol, 'admin');
        assert.ok(client.cookie.startsWith('asistencia.sid='));

        const currentUser = await client.request('/api/current-user');
        assert.equal(currentUser.status, 200);
        assert.equal(currentUser.body.email, 'admin@test.local');
    });

    test('valida y administra el ciclo de vida de un usuario', async () => {
        const client = new HttpTestClient(baseUrl);
        await client.login('admin@test.local', 'Admin12345');

        const invalid = await client.request('/api/users', {
            method: 'POST',
            body: {
                nombre: 'Nueva Empleada',
                email: 'nueva@test.local',
                contrasena: 'corta',
                rol: 'empleado'
            }
        });
        assert.equal(invalid.status, 400);
        assert.equal(invalid.body.code, 'INVALID_PASSWORD');

        const created = await client.request('/api/users', {
            method: 'POST',
            body: {
                nombre: 'Nueva Empleada',
                email: 'NUEVA@test.local',
                contrasena: 'Nueva12345',
                rol: 'empleado'
            }
        });
        assert.equal(created.status, 201);
        assert.equal(created.body.user.email, 'nueva@test.local');

        const duplicate = await client.request('/api/users', {
            method: 'POST',
            body: {
                nombre: 'Correo Repetido',
                email: 'nueva@test.local',
                contrasena: 'Nueva12345',
                rol: 'empleado'
            }
        });
        assert.equal(duplicate.status, 409);

        const updated = await client.request(`/api/users/${created.body.user.id}`, {
            method: 'PUT',
            body: {
                nombre: 'Nombre Modificado',
                email: 'modificada@test.local',
                contrasena: '',
                rol: 'empleado'
            }
        });
        assert.equal(updated.status, 200);
        assert.equal(updated.body.user.nombre, 'Nombre Modificado');

        const deactivated = await client.request(`/api/users/${created.body.user.id}/deactivate`, {
            method: 'PUT'
        });
        assert.equal(deactivated.status, 200);
        assert.equal(Boolean(deactivated.body.user.activo), false);

        const users = await client.request('/api/users');
        assert.equal(users.status, 200);
        assert.equal(users.body.some((user) => user.id === created.body.user.id), true);

        const selfDeactivation = await client.request(`/api/users/${fixtures.adminId}/deactivate`, {
            method: 'PUT'
        });
        assert.equal(selfDeactivation.status, 409);
        assert.equal(selfDeactivation.body.code, 'SELF_DEACTIVATION');
    });

    test('aplica permisos y reglas de entrada y salida del empleado', async () => {
        const employee = new HttpTestClient(baseUrl);
        await employee.login('empleado@test.local', 'Empleado12345');

        const adminRoute = await employee.request('/api/users');
        assert.equal(adminRoute.status, 403);

        const exitWithoutEntry = await employee.request('/api/attendance/mark', {
            method: 'POST',
            body: { tipo: 'salida' }
        });
        assert.equal(exitWithoutEntry.status, 409);
        assert.equal(exitWithoutEntry.body.code, 'MISSING_ENTRY');

        const entry = await employee.request('/api/attendance/mark', {
            method: 'POST',
            body: { tipo: 'entrada' }
        });
        assert.equal(entry.status, 201);

        const duplicateEntry = await employee.request('/api/attendance/mark', {
            method: 'POST',
            body: { tipo: 'entrada' }
        });
        assert.equal(duplicateEntry.status, 409);
        assert.equal(duplicateEntry.body.code, 'DUPLICATE_ENTRY');

        const status = await employee.request('/api/attendance/status');
        assert.equal(status.status, 200);
        assert.equal(status.body.records.length, 1);
        assert.equal(status.body.records[0].tipo, 'entrada');
    });

    test('clasifica atrasos, salidas anticipadas e inasistencias', async () => {
        fixtures = await resetFixtures(pool, { includeSecondEmployee: true });
        const [[employee]] = await pool.query(
            'SELECT contrasena FROM usuarios WHERE id = ?',
            [fixtures.employeeId]
        );
        const [punctualResult] = await pool.query(
            'INSERT INTO usuarios (nombre, email, contrasena, rol) VALUES (?, ?, ?, ?)',
            ['Empleado Puntual', 'puntual@test.local', employee.contrasena, 'empleado']
        );

        await pool.query(
            'INSERT INTO asistencia (usuario_id, tipo, fecha_hora) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?)',
            [
                fixtures.employeeId, 'entrada', '2026-09-22 09:31:00',
                fixtures.employeeId, 'salida', '2026-09-22 17:29:00',
                punctualResult.insertId, 'entrada', '2026-09-22 09:30:00',
                punctualResult.insertId, 'salida', '2026-09-22 17:30:00'
            ]
        );

        const admin = new HttpTestClient(baseUrl);
        await admin.login('admin@test.local', 'Admin12345');
        const late = await admin.request('/api/reports/late?fecha=2026-09-22');
        const early = await admin.request('/api/reports/early?fecha=2026-09-22');
        const absent = await admin.request('/api/reports/absent?fecha=2026-09-22');

        assert.deepEqual(late.body.map((row) => row.id), [fixtures.employeeId]);
        assert.deepEqual(early.body.map((row) => row.id), [fixtures.employeeId]);
        assert.deepEqual(absent.body.map((row) => row.id), [fixtures.secondEmployeeId]);
    });
});
