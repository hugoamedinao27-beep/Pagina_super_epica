const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.BUSINESS_TIMEZONE = 'America/Santiago';

const { getBusinessDateTime } = require('../../utils/business-time');

test('convierte un instante UTC a la hora civil de Santiago', () => {
    const result = getBusinessDateTime(new Date('2026-01-15T15:04:05.000Z'));

    assert.deepEqual(result, {
        date: '2026-01-15',
        time: '12:04:05',
        dateTime: '2026-01-15 12:04:05'
    });
});

test('calcula correctamente el cambio de fecha en Santiago', () => {
    const result = getBusinessDateTime(new Date('2026-01-15T02:30:00.000Z'));

    assert.equal(result.date, '2026-01-14');
    assert.equal(result.time, '23:30:00');
});
