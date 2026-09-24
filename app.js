const express = require('express');
const session = require('express-session');
const path = require('path');
const config = require('./config/environment');
const pool = require('./database/connection');
const asyncHandler = require('./middleware/async-handler');
const { requirePageAuth, requireAdminPage } = require('./middleware/auth');
const { notFoundHandler, errorHandler } = require('./middleware/error-handler');
const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const reportRoutes = require('./routes/reports');
const userRoutes = require('./routes/users');

/**
 * Aplicación Express sin iniciar el puerto de escucha.
 * Esta separación permite importar la aplicación desde las pruebas de integración.
 */
const app = express();
const sourceDirectory = path.join(__dirname, 'src');

app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.use(session({
    name: config.session.name,
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.session.secureCookie,
        maxAge: config.session.maxAgeMs
    }
}));

app.use('/css', express.static(path.join(sourceDirectory, 'css')));
app.use('/js', express.static(path.join(sourceDirectory, 'js')));

/** GET /api/health: comprueba que Express y MySQL respondan correctamente. */
app.get('/api/health', asyncHandler(async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ success: true, status: 'ok' });
}));

app.use('/api', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);

/** Página pública de inicio de sesión. */
app.get('/', (req, res) => {
    res.sendFile(path.join(sourceDirectory, 'pages', 'login.html'));
});
/** Panel del empleado; requiere una cuenta activa. */
app.get('/dashboard', requirePageAuth, (req, res) => {
    res.sendFile(path.join(sourceDirectory, 'pages', 'dashboard.html'));
});
/** Panel administrativo; requiere una cuenta activa con rol admin. */
app.get('/admin', requireAdminPage, (req, res) => {
    res.sendFile(path.join(sourceDirectory, 'pages', 'admin.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
