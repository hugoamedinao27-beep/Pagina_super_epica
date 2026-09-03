const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const pool = require('./database/connection');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'src')));
app.use(session({
    secret: 'tienda-super-wai-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
    if (!req.session.user) return res.status(401).json({ success: false, message: 'No autenticado' });
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.rol !== 'admin') return res.status(403).json({ success: false, message: 'Sin permisos' });
    next();
}

// AUTH
app.post('/api/register', async (req, res) => {
    const { nombre, email, contrasena } = req.body;

    if (!nombre || !email || !contrasena) {
        return res.json({ success: false, message: 'Todos los campos son obligatorios' });
    }

    const [existing] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existing.length > 0) {
        return res.json({ success: false, message: 'Este correo ya esta registrado' });
    }

    const hash = await bcrypt.hash(contrasena, 10);
    await pool.query('INSERT INTO usuarios (nombre, email, contrasena, rol) VALUES (?, ?, ?, ?)', [nombre, email, hash, 'empleado']);

    res.json({ success: true, message: 'Cuenta creada correctamente' });
});

app.post('/api/login', async (req, res) => {
    const { email, contrasena } = req.body;
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ? AND activo = TRUE', [email]);
    if (rows.length === 0) return res.json({ success: false, message: 'Usuario no encontrado' });

    const user = rows[0];
    const valid = await bcrypt.compare(contrasena, user.contrasena);
    if (!valid) return res.json({ success: false, message: 'Contrasena incorrecta' });

    req.session.user = { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
    res.json({ success: true, user: req.session.user });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/current-user', requireAuth, (req, res) => {
    res.json(req.session.user);
});

// ATTENDANCE
app.post('/api/attendance/mark', requireAuth, async (req, res) => {
    const { tipo } = req.body;
    const userId = req.session.user.id;

    try {
        // 1. REGLA: Solo 1 entrada y 1 salida por día
        // Le pasamos la variable "tipo" a la consulta SQL para que valide dinámicamente
        const [registrosHoy] = await pool.query(
            "SELECT id FROM asistencia WHERE usuario_id = ? AND tipo = ? AND DATE(fecha_hora) = CURDATE()",
            [userId, tipo]
        );
        
        if (registrosHoy.length > 0) {
            return res.json({ 
                success: false, 
                // El mensaje cambiará automáticamente según el botón que presionó
                message: `Ya registraste tu ${tipo} el día de hoy.` 
            });
        }

        // 2. REGLA: Validación Anti-Spam (1 minuto de diferencia)
        // Esto evita que marquen "Entrada" y casi instantáneamente marquen "Salida" por error
        const [rows] = await pool.query(
            'SELECT TIMESTAMPDIFF(SECOND, fecha_hora, NOW()) as segundos FROM asistencia WHERE usuario_id = ? ORDER BY id DESC LIMIT 1',
            [userId]
        );

        if (rows.length > 0) {
            const segundos = rows[0].segundos;
            if (segundos >= 0 && segundos < 60) {
                return res.json({ 
                    success: false, 
                    message: 'Espera al menos 1 minuto antes de volver a marcar.' 
                });
            }
        }

        // 3. Registrar Asistencia
        await pool.query(
            'INSERT INTO asistencia (usuario_id, tipo, fecha_hora) VALUES (?, ?, NOW())',
            [userId, tipo]
        );
        
        res.json({ success: true, message: `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} registrada` });

    } catch (error) {
        console.error('Error bd:', error);
        res.json({ success: false, message: 'Error al marcar asistencia.' });
    }
});

app.get('/api/attendance/status', requireAuth, async (req, res) => {
    // 4. Cambiamos la validación. Ya no usamos el reloj de JavaScript, 
    // usamos CURDATE() para que MySQL nos traiga los datos de "HOY" según su propio reloj local.
    const [rows] = await pool.query(
        'SELECT tipo, fecha_hora FROM asistencia WHERE usuario_id = ? AND DATE(fecha_hora) = CURDATE() ORDER BY fecha_hora',
        [req.session.user.id]
    );
    res.json({ records: rows });
});

// REPORTS
app.get('/api/reports/late', requireAdmin, async (req, res) => {
    const { fecha } = req.query;
    const [rows] = await pool.query(`
        SELECT u.id, u.nombre, u.email, a.fecha_hora, TIME(a.fecha_hora) as hora_llegada
        FROM asistencia a JOIN usuarios u ON a.usuario_id = u.id
        WHERE a.tipo = 'entrada' AND DATE(a.fecha_hora) = ? AND TIME(a.fecha_hora) > '09:30:00'
        ORDER BY a.fecha_hora
    `, [fecha]);
    res.json(rows);
});

app.get('/api/reports/early', requireAdmin, async (req, res) => {
    const { fecha } = req.query;
    const [rows] = await pool.query(`
        SELECT u.id, u.nombre, u.email, a.fecha_hora, TIME(a.fecha_hora) as hora_salida
        FROM asistencia a JOIN usuarios u ON a.usuario_id = u.id
        WHERE a.tipo = 'salida' AND DATE(a.fecha_hora) = ? AND TIME(a.fecha_hora) < '17:30:00'
        ORDER BY a.fecha_hora
    `, [fecha]);
    res.json(rows);
});

app.get('/api/reports/absent', requireAdmin, async (req, res) => {
    const { fecha } = req.query;
    const [rows] = await pool.query(`
        SELECT u.id, u.nombre, u.email
        FROM usuarios u
        WHERE u.activo = TRUE AND u.id NOT IN (
            SELECT DISTINCT usuario_id FROM asistencia WHERE DATE(fecha_hora) = ?
        )
        ORDER BY u.nombre
    `, [fecha]);
    res.json(rows);
});

// USER MANAGEMENT
app.get('/api/users', requireAdmin, async (req, res) => {
    const [rows] = await pool.query('SELECT id, nombre, email, rol, activo, creado_en FROM usuarios ORDER BY nombre');
    res.json(rows);
});

app.post('/api/users', requireAdmin, async (req, res) => {
    const { nombre, email, contrasena, rol } = req.body;
    const hash = await bcrypt.hash(contrasena, 10);
    await pool.query('INSERT INTO usuarios (nombre, email, contrasena, rol) VALUES (?, ?, ?, ?)', [nombre, email, hash, rol || 'empleado']);
    res.json({ success: true });
});

app.put('/api/users/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { nombre, email, contrasena, rol } = req.body;
    if (contrasena) {
        const hash = await bcrypt.hash(contrasena, 10);
        await pool.query('UPDATE usuarios SET nombre = ?, email = ?, contrasena = ?, rol = ? WHERE id = ?', [nombre, email, hash, rol, id]);
    } else {
        await pool.query('UPDATE usuarios SET nombre = ?, email = ?, rol = ? WHERE id = ?', [nombre, email, rol, id]);
    }
    res.json({ success: true });
});

app.put('/api/users/:id/deactivate', requireAdmin, async (req, res) => {
    await pool.query('UPDATE usuarios SET activo = FALSE WHERE id = ?', [req.params.id]);
    res.json({ success: true });
});

app.put('/api/users/:id/activate', requireAdmin, async (req, res) => {
    await pool.query('UPDATE usuarios SET activo = TRUE WHERE id = ?', [req.params.id]);
    res.json({ success: true });
});

// PAGES
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'src', 'pages', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'src', 'pages', 'dashboard.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'src', 'pages', 'admin.html')));

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
