document.getElementById('loginYear').textContent = new Date().getFullYear();

// Check setup required or already authenticated
async function checkState() {
    const setupRes = await fetch('/api/auth/setup-required');
    const setupData = await setupRes.json();
    if (setupData.required) {
        window.location.replace('/setup.html');
        return;
    }
    const meRes = await fetch('/api/auth/me');
    if (meRes.ok) window.location.replace('/index.html');
}
checkState().catch(() => {});

const form    = document.getElementById('loginForm');
const errorEl = document.getElementById('loginError');
const btn     = document.getElementById('loginBtn');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Signing in…';

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('username').value,
                password: document.getElementById('password').value,
            }),
        });

        const data = await res.json();

        if (res.ok) {
            window.location.replace('/index.html');
        } else if (data.setupRequired) {
            window.location.replace('/setup.html');
        } else {
            errorEl.textContent = data.error || 'Login failed';
            errorEl.style.display = 'flex';
            btn.disabled = false;
            btn.textContent = 'Sign in';
        }
    } catch {
        errorEl.textContent = 'Network error — please try again';
        errorEl.style.display = 'flex';
        btn.disabled = false;
        btn.textContent = 'Sign in';
    }
});
