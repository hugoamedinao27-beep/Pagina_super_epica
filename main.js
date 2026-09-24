const app = require('./app');
const config = require('./config/environment');
const pool = require('./database/connection');

const server = app.listen(config.port, () => {
    console.log(`Servidor corriendo en http://localhost:${config.port}`);
});

/**
 * Cierra primero el servidor HTTP y después el pool de MySQL para evitar
 * solicitudes o conexiones interrumpidas durante el apagado.
 */
async function shutdown(signal) {
    console.log(`\n${signal} recibido. Cerrando servidor...`);

    server.close(async () => {
        await pool.end();
        process.exit(0);
    });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = server;
