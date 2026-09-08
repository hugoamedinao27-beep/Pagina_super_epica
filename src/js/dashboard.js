const BUSINESS_TIME_ZONE = 'America/Santiago';

function updateClock() {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleTimeString('es-CL', {
        timeZone: BUSINESS_TIME_ZONE
    });
    document.getElementById('currentDate').textContent = now.toLocaleDateString('es-CL', {
        timeZone: BUSINESS_TIME_ZONE,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

async function requestJson(url, options = {}) {
    let response;

    try {
        response = await fetch(url, options);
    } catch (error) {
        throw new Error('No fue posible conectar con el servidor. Verifica que esté iniciado.');
    }

    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
        window.location.href = '/';
        throw new Error('Tu sesión terminó. Inicia sesión nuevamente.');
    }
    if (!response.ok) {
        throw new Error(result.message || 'No fue posible completar la operación.');
    }

    return result;
}

async function loadUser() {
    const user = await requestJson('/api/current-user');
    document.getElementById('userName').textContent = user.nombre;
}

function renderRecords(records) {
    const list = document.getElementById('recordList');
    list.replaceChildren();

    if (records.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'no-data';
        empty.textContent = 'Sin registros hoy';
        list.appendChild(empty);
        return;
    }

    records.forEach((record) => {
        const item = document.createElement('li');
        const badge = document.createElement('span');
        const time = document.createElement('span');
        badge.className = record.tipo === 'entrada' ? 'badge-entrada' : 'badge-salida';
        badge.textContent = record.tipo.toUpperCase();
        time.textContent = record.hora;
        item.append(badge, time);
        list.appendChild(item);
    });
}

async function loadRecords() {
    const result = await requestJson('/api/attendance/status');
    renderRecords(result.records);
}

async function markAttendance(type, button) {
    const buttons = document.querySelectorAll('.attendance-buttons button');
    buttons.forEach((item) => { item.disabled = true; });

    try {
        const result = await requestJson('/api/attendance/mark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: type })
        });
        showToast(result.message, 'success');
        await loadRecords();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        buttons.forEach((item) => { item.disabled = false; });
        button.focus();
    }
}

document.getElementById('btnEntrada').addEventListener('click', (event) => {
    markAttendance('entrada', event.currentTarget);
});

document.getElementById('btnSalida').addEventListener('click', (event) => {
    markAttendance('salida', event.currentTarget);
});

document.getElementById('btnLogout').addEventListener('click', async () => {
    try {
        await requestJson('/api/logout', { method: 'POST' });
    } finally {
        window.location.href = '/';
    }
});

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

setInterval(updateClock, 1000);
updateClock();
Promise.all([loadUser(), loadRecords()]).catch((error) => showToast(error.message, 'error'));
