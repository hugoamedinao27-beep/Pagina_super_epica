const BUSINESS_TIME_ZONE = 'America/Santiago';

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
    if (response.status === 403) {
        window.location.href = '/dashboard';
        throw new Error(result.message || 'No tienes permiso para realizar esta acción.');
    }
    if (!response.ok) {
        throw new Error(result.message || 'No fue posible completar la operación.');
    }

    return result;
}

function todayInBusinessTimeZone() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: BUSINESS_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
}

function createCell(value) {
    const cell = document.createElement('td');
    cell.textContent = value ?? '';
    return cell;
}

function setButtonBusy(button, busy, busyLabel = 'Procesando...') {
    if (!button.dataset.defaultLabel) {
        button.dataset.defaultLabel = button.textContent;
    }
    button.disabled = busy;
    button.dataset.busy = String(busy);
    button.textContent = busy ? busyLabel : button.dataset.defaultLabel;
}

document.querySelectorAll('.tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((item) => item.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        document.getElementById(`tab-${button.dataset.tab}`).classList.add('active');
    });
});

document.querySelectorAll('.report-tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.report-tab-btn').forEach((item) => {
            item.classList.remove('active');
            item.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.report-panel').forEach((panel) => {
            panel.classList.remove('active');
            panel.hidden = true;
        });

        button.classList.add('active');
        button.setAttribute('aria-selected', 'true');
        const panel = document.getElementById(`report-${button.dataset.report}`);
        panel.hidden = false;
        panel.classList.add('active');
    });
});

const currentDate = todayInBusinessTimeZone();
document.getElementById('lateDate').value = currentDate;
document.getElementById('earlyDate').value = currentDate;
document.getElementById('absentDate').value = currentDate;

const REPORT_PAGE_SIZE = 25;
const reportConfigs = {
    late: {
        input: 'lateDate',
        table: 'lateTable',
        noData: 'lateNoData',
        endpoint: '/api/reports/late',
        fields: ['id', 'nombre', 'email', 'hora_llegada'],
        generate: 'btnLateReport',
        pagination: 'latePagination',
        previous: 'latePrev',
        next: 'lateNext',
        pageInfo: 'latePageInfo',
        summary: 'lateSummary'
    },
    early: {
        input: 'earlyDate',
        table: 'earlyTable',
        noData: 'earlyNoData',
        endpoint: '/api/reports/early',
        fields: ['id', 'nombre', 'email', 'hora_salida'],
        generate: 'btnEarlyReport',
        pagination: 'earlyPagination',
        previous: 'earlyPrev',
        next: 'earlyNext',
        pageInfo: 'earlyPageInfo',
        summary: 'earlySummary'
    },
    absent: {
        input: 'absentDate',
        table: 'absentTable',
        noData: 'absentNoData',
        endpoint: '/api/reports/absent',
        fields: ['id', 'nombre', 'email'],
        generate: 'btnAbsentReport',
        pagination: 'absentPagination',
        previous: 'absentPrev',
        next: 'absentNext',
        pageInfo: 'absentPageInfo',
        summary: 'absentSummary'
    }
};

Object.values(reportConfigs).forEach((config) => {
    Object.assign(config, {
        loaded: false,
        page: 1,
        totalPages: 0,
        total: 0,
        itemCount: 0
    });
});

async function loadUser() {
    const user = await requestJson('/api/current-user');
    if (user.rol !== 'admin') {
        window.location.href = '/dashboard';
        return;
    }
    document.getElementById('userName').textContent = user.nombre;
}

function renderReport(config, rows) {
    const tbody = document.querySelector(`#${config.table} tbody`);
    const emptyMessage = document.getElementById(config.noData);
    tbody.replaceChildren();

    rows.forEach((row) => {
        const tr = document.createElement('tr');
        config.fields.forEach((field) => tr.appendChild(createCell(row[field])));
        tbody.appendChild(tr);
    });

    emptyMessage.textContent = rows.length === 0
        ? 'No se encontraron resultados para la fecha seleccionada.'
        : '';
    emptyMessage.hidden = rows.length > 0;
}

function updateReportPagination(config) {
    const pagination = document.getElementById(config.pagination);
    const summary = document.getElementById(config.summary);

    if (!config.loaded || config.total === 0) {
        pagination.hidden = true;
        summary.hidden = true;
        return;
    }

    pagination.hidden = false;
    summary.hidden = false;
    document.getElementById(config.pageInfo).textContent = `Página ${config.page} de ${config.totalPages}`;
    document.getElementById(config.previous).disabled = config.page <= 1;
    document.getElementById(config.next).disabled = config.page >= config.totalPages;

    const firstResult = ((config.page - 1) * REPORT_PAGE_SIZE) + 1;
    const lastResult = firstResult + config.itemCount - 1;
    summary.textContent = `Mostrando ${firstResult}–${lastResult} de ${config.total} resultados`;
}

function resetReport(config) {
    document.querySelector(`#${config.table} tbody`).replaceChildren();
    const emptyMessage = document.getElementById(config.noData);
    emptyMessage.textContent = 'Seleccione una fecha y presione Generar';
    emptyMessage.hidden = false;
    Object.assign(config, {
        loaded: false,
        page: 1,
        totalPages: 0,
        total: 0,
        itemCount: 0
    });
    updateReportPagination(config);
}

async function loadReport(config, requestedPage, triggerButton) {
    const date = document.getElementById(config.input).value;
    if (!date) {
        showToast('Selecciona una fecha válida.', 'error');
        return;
    }

    setButtonBusy(triggerButton, true, 'Cargando...');

    try {
        const query = new URLSearchParams({
            fecha: date,
            pagina: String(requestedPage),
            limite: String(REPORT_PAGE_SIZE)
        });
        const result = await requestJson(`${config.endpoint}?${query}`);
        renderReport(config, result.items);
        Object.assign(config, {
            loaded: true,
            page: result.pagination.page,
            totalPages: result.pagination.totalPages,
            total: result.pagination.total,
            itemCount: result.items.length
        });
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        setButtonBusy(triggerButton, false);
        updateReportPagination(config);
    }
}

Object.values(reportConfigs).forEach((config) => {
    document.getElementById(config.generate).addEventListener('click', (event) => {
        loadReport(config, 1, event.currentTarget);
    });
    document.getElementById(config.previous).addEventListener('click', (event) => {
        loadReport(config, config.page - 1, event.currentTarget);
    });
    document.getElementById(config.next).addEventListener('click', (event) => {
        loadReport(config, config.page + 1, event.currentTarget);
    });
    document.getElementById(config.input).addEventListener('change', () => resetReport(config));
});

const modal = document.getElementById('userModal');
const form = document.getElementById('userForm');
const passwordInput = document.getElementById('userPass');

function closeModal() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
}

function openModal() {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('userNameInput').focus();
}

function editUser(user) {
    document.getElementById('modalTitle').textContent = 'Modificar usuario';
    document.getElementById('passHint').textContent = '(dejar vacía para conservarla)';
    passwordInput.required = false;
    document.getElementById('userId').value = user.id;
    document.getElementById('userNameInput').value = user.nombre;
    document.getElementById('userEmail').value = user.email;
    document.getElementById('userRol').value = user.rol;
    passwordInput.value = '';
    openModal();
}

async function toggleUser(id, activate, button) {
    const action = activate ? 'activar' : 'desactivar';
    if (!window.confirm(`¿Deseas ${action} este usuario?`)) {
        return;
    }

    setButtonBusy(button, true);
    try {
        await requestJson(`/api/users/${id}/${activate ? 'activate' : 'deactivate'}`, {
            method: 'PUT'
        });
        showToast(activate ? 'Usuario activado.' : 'Usuario desactivado.', 'success');
        await loadUsers();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        setButtonBusy(button, false);
    }
}

function renderUsers(users) {
    const tbody = document.querySelector('#usersTable tbody');
    tbody.replaceChildren();

    users.forEach((user) => {
        const row = document.createElement('tr');
        row.append(
            createCell(user.id),
            createCell(user.nombre),
            createCell(user.email),
            createCell(user.rol === 'admin' ? 'Administrador' : 'Empleado'),
            createCell(user.activo ? 'Activo' : 'Inactivo')
        );

        const actions = document.createElement('td');
        actions.className = 'table-actions';

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'btn btn-secondary btn-small';
        editButton.textContent = 'Editar';
        editButton.addEventListener('click', () => editUser(user));

        const stateButton = document.createElement('button');
        stateButton.type = 'button';
        stateButton.className = `btn ${user.activo ? 'btn-danger' : 'btn-success'} btn-small`;
        stateButton.textContent = user.activo ? 'Desactivar' : 'Activar';
        stateButton.addEventListener('click', () => toggleUser(user.id, !user.activo, stateButton));

        actions.append(editButton, stateButton);
        row.appendChild(actions);
        tbody.appendChild(row);
    });
}

async function loadUsers() {
    try {
        renderUsers(await requestJson('/api/users'));
    } catch (error) {
        showToast(error.message, 'error');
    }
}

document.getElementById('btnNewUser').addEventListener('click', () => {
    form.reset();
    document.getElementById('modalTitle').textContent = 'Crear usuario';
    document.getElementById('passHint').textContent = '(mínimo 8 caracteres, una letra y un número)';
    passwordInput.required = true;
    document.getElementById('userId').value = '';
    openModal();
});

document.getElementById('btnCancelModal').addEventListener('click', closeModal);
modal.addEventListener('click', (event) => {
    if (event.target === modal) {
        closeModal();
    }
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
    }
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.getElementById('userId').value;
    const saveButton = document.getElementById('btnSaveUser');
    const data = {
        nombre: document.getElementById('userNameInput').value,
        email: document.getElementById('userEmail').value,
        contrasena: passwordInput.value,
        rol: document.getElementById('userRol').value
    };

    setButtonBusy(saveButton, true, 'Guardando...');
    try {
        await requestJson(id ? `/api/users/${id}` : '/api/users', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        showToast(id ? 'Usuario modificado.' : 'Usuario creado.', 'success');
        closeModal();
        await loadUsers();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        setButtonBusy(saveButton, false);
    }
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

Promise.all([loadUser(), loadUsers()]).catch((error) => showToast(error.message, 'error'));
