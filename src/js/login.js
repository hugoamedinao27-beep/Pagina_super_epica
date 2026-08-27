document.getElementById('showRegister').addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('.login-container').style.display = 'none';
    document.getElementById('registerSection').style.display = 'flex';
});

document.getElementById('showLogin').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('registerSection').style.display = 'none';
    document.querySelector('.login-container').style.display = 'flex';
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const contrasena = document.getElementById('contrasena').value;
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.textContent = '';

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, contrasena })
    });
    const result = await res.json();

    if (result.success) {
        if (result.user.rol === 'admin') {
            window.location.href = '/admin';
        } else {
            window.location.href = '/dashboard';
        }
    } else {
        errorMsg.textContent = result.message;
    }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('regNombre').value;
    const email = document.getElementById('regEmail').value;
    const contrasena = document.getElementById('regContrasena').value;
    const contrasena2 = document.getElementById('regContrasena2').value;
    const errorMsg = document.getElementById('registerError');
    const successMsg = document.getElementById('registerSuccess');
    errorMsg.textContent = '';
    successMsg.textContent = '';

    if (contrasena !== contrasena2) {
        errorMsg.textContent = 'Las contrasenas no coinciden';
        return;
    }

    if (contrasena.length < 6) {
        errorMsg.textContent = 'La contrasena debe tener al menos 6 caracteres';
        return;
    }

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, contrasena })
    });
    const result = await res.json();

    if (result.success) {
        successMsg.textContent = 'Cuenta creada! Ya puedes iniciar sesion.';
        document.getElementById('registerForm').reset();
    } else {
        errorMsg.textContent = result.message;
    }
});
