const config = require('../config/environment');

const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.business.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
});

/**
 * Convierte un instante a la fecha y hora civil de la zona horaria del negocio.
 * MySQL guarda este valor como DATETIME para que las reglas laborales no dependan
 * de la zona horaria configurada en el computador o en el servidor de base de datos.
 */
function getBusinessDateTime(date = new Date()) {
    const parts = Object.fromEntries(
        formatter.formatToParts(date)
            .filter((part) => part.type !== 'literal')
            .map((part) => [part.type, part.value])
    );

    const businessDate = `${parts.year}-${parts.month}-${parts.day}`;
    const businessTime = `${parts.hour}:${parts.minute}:${parts.second}`;

    return {
        date: businessDate,
        time: businessTime,
        dateTime: `${businessDate} ${businessTime}`
    };
}

module.exports = { getBusinessDateTime };
