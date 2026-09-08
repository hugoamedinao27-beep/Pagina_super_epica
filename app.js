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

app.get('/api/health', asyncHandler(async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ success: true, status: 'ok' });
}));

app.use('/api', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(sourceDirectory, 'pages', 'login.html'));
});
app.get('/dashboard', requirePageAuth, (req, res) => {
    res.sendFile(path.join(sourceDirectory, 'pages', 'dashboard.html'));
});
app.get('/admin', requireAdminPage, (req, res) => {
    res.sendFile(path.join(sourceDirectory, 'pages', 'admin.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
