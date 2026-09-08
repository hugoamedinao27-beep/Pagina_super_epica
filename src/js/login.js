const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('btnLogin');
const errorMessage = document.getElementById('errorMsg');

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorMessage.textContent = '';
    loginButton.disabled = true;
    loginButton.textContent = 'Ingresando...';

    const email = document.getElementById('email').value.trim();
    const contrasena = document.getElementById('contrasena').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, contrasena })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            errorMessage.textContent = result.message || 'No fue posible iniciar sesión.';
            return;
        }

        window.location.href = result.user.rol === 'admin' ? '/admin' : '/dashboard';
    } catch (error) {
        errorMessage.textContent = 'No fue posible conectar con el servidor.';
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'Iniciar sesión';
    }
});
