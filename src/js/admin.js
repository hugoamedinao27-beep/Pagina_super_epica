document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
});

function today() { return new Date().toISOString().slice(0, 10); }
document.getElementById('lateDate').value = today();
document.getElementById('earlyDate').value = today();
document.getElementById('absentDate').value = today();

async function loadUser() {
    const res = await fetch('/api/current-user');
    if (res.status === 401) { window.location.href = '/'; return; }
    const user = await res.json();
    document.getElementById('userName').textContent = user.nombre;
}

// REPORTS
document.getElementById('btnLateReport').addEventListener('click', async () => {
    const fecha = document.getElementById('lateDate').value;
    const res = await fetch(`/api/reports/late?fecha=${fecha}`);
    const data = await res.json();
    const tbody = document.querySelector('#lateTable tbody');
    const noData = document.getElementById('lateNoData');
    if (data.length === 0) { tbody.innerHTML = ''; noData.style.display = 'block'; return; }
    noData.style.display = 'none';
    tbody.innerHTML = data.map(r => `<tr><td>${r.id}</td><td>${r.nombre}</td><td>${r.email}</td><td>${r.hora_llegada}</td></tr>`).join('');
});

document.getElementById('btnEarlyReport').addEventListener('click', async () => {
    const fecha = document.getElementById('earlyDate').value;
    const res = await fetch(`/api/reports/early?fecha=${fecha}`);
    const data = await res.json();
    const tbody = document.querySelector('#earlyTable tbody');
    const noData = document.getElementById('earlyNoData');
    if (data.length === 0) { tbody.innerHTML = ''; noData.style.display = 'block'; return; }
    noData.style.display = 'none';
    tbody.innerHTML = data.map(r => `<tr><td>${r.id}</td><td>${r.nombre}</td><td>${r.email}</td><td>${r.hora_salida}</td></tr>`).join('');
});

document.getElementById('btnAbsentReport').addEventListener('click', async () => {
    const fecha = document.getElementById('absentDate').value;
    const res = await fetch(`/api/reports/absent?fecha=${fecha}`);
    const data = await res.json();
    const tbody = document.querySelector('#absentTable tbody');
    const noData = document.getElementById('absentNoData');
    if (data.length === 0) { tbody.innerHTML = ''; noData.style.display = 'block'; return; }
    noData.style.display = 'none';
    tbody.innerHTML = data.map(r => `<tr><td>${r.id}</td><td>${r.nombre}</td><td>${r.email}</td></tr>`).join('');
});

// USERS
async function loadUsers() {
    const res = await fetch('/api/users');
    const users = await res.json();
    const tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = users.map(u => `
        <tr>
            <td>${u.id}</td><td>${u.nombre}</td><td>${u.email}</td><td>${u.rol}</td>
            <td>${u.activo ? 'Activo' : 'Inactivo'}</td>
            <td>
                <button class="btn btn-secondary btn-small" onclick='editUser(${JSON.stringify(u)})'>Editar</button>
                ${u.activo
                    ? `<button class="btn btn-danger btn-small" onclick="toggleUser(${u.id}, false)">Desactivar</button>`
                    : `<button class="btn btn-success btn-small" onclick="toggleUser(${u.id}, true)">Activar</button>`}
            </td>
        </tr>
    `).join('');
}

// MODAL
const modal = document.getElementById('userModal');
const form = document.getElementById('userForm');

document.getElementById('btnNewUser').addEventListener('click', () => {
    document.getElementById('modalTitle').textContent = 'Crear Usuario';
    document.getElementById('passHint').textContent = '';
    document.getElementById('userPass').required = true;
    form.reset();
    document.getElementById('userId').value = '';
    modal.classList.add('active');
});

document.getElementById('btnCancelModal').addEventListener('click', () => modal.classList.remove('active'));

window.editUser = (u) => {
    document.getElementById('modalTitle').textContent = 'Modificar Usuario';
    document.getElementById('passHint').textContent = '(dejar vacio para no cambiar)';
    document.getElementById('userPass').required = false;
    document.getElementById('userId').value = u.id;
    document.getElementById('userNameInput').value = u.nombre;
    document.getElementById('userEmail').value = u.email;
    document.getElementById('userRol').value = u.rol;
    document.getElementById('userPass').value = '';
    modal.classList.add('active');
};

window.toggleUser = async (id, activate) => {
    if (!confirm(activate ? 'Activar este usuario?' : 'Desactivar este usuario?')) return;
    await fetch(`/api/users/${id}/${activate ? 'activate' : 'deactivate'}`, { method: 'PUT' });
    loadUsers();
    showToast(activate ? 'Usuario activado' : 'Usuario desactivado', 'success');
};

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('userId').value;
    const data = {
        nombre: document.getElementById('userNameInput').value,
        email: document.getElementById('userEmail').value,
        contrasena: document.getElementById('userPass').value,
        rol: document.getElementById('userRol').value
    };

    if (id) {
        await fetch(`/api/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        showToast('Usuario modificado', 'success');
    } else {
        await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        showToast('Usuario creado', 'success');
    }
    modal.classList.remove('active');
    loadUsers();
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

loadUser();
loadUsers();
