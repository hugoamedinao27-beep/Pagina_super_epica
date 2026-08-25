function updateClock() {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleTimeString('es-CL');
    document.getElementById('currentDate').textContent = now.toLocaleDateString('es-CL', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

async function loadUser() {
    const res = await fetch('/api/current-user');
    if (res.status === 401) { window.location.href = '/'; return; }
    const user = await res.json();
    document.getElementById('userName').textContent = user.nombre;
}

async function loadRecords() {
    const res = await fetch('/api/attendance/status');
    const result = await res.json();
    const list = document.getElementById('recordList');
    if (result.records.length === 0) {
        list.innerHTML = '<li class="no-data">Sin registros hoy</li>';
        return;
    }
    list.innerHTML = result.records.map(r => {
        const time = new Date(r.fecha_hora).toLocaleTimeString('es-CL');
        const badge = r.tipo === 'entrada' ? 'badge-entrada' : 'badge-salida';
        return `<li><span class="${badge}">${r.tipo.toUpperCase()}</span><span>${time}</span></li>`;
    }).join('');
}

document.getElementById('btnEntrada').addEventListener('click', async () => {
    const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'entrada' })
    });
    const result = await res.json();
    showToast(result.message, result.success ? 'success' : 'error');
    loadRecords();
});

document.getElementById('btnSalida').addEventListener('click', async () => {
    const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'salida' })
    });
    const result = await res.json();
    showToast(result.message, result.success ? 'success' : 'error');
    loadRecords();
});

document.getElementById('btnLogout').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
});

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

setInterval(updateClock, 1000);
updateClock();
loadUser();
loadRecords();
