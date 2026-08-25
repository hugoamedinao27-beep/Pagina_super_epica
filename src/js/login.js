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
