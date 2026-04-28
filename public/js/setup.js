document.getElementById('setupYear').textContent = new Date().getFullYear();

// If setup not required, redirect appropriately
fetch('/api/auth/setup-required')
    .then(r => r.json())
    .then(d => { if (!d.required) window.location.replace('/login.html'); })
    .catch(() => {});

const form    = document.getElementById('setupForm');
const errorEl = document.getElementById('setupError');
const btn     = document.getElementById('setupBtn');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirm  = document.getElementById('confirmPassword').value;

    if (password !== confirm) {
        errorEl.textContent = 'Passwords do not match';
        errorEl.style.display = 'flex';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating account…';

    try {
        const res = await fetch('/api/auth/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (res.ok) {
            window.location.replace('/login.html');
        } else {
            errorEl.textContent = data.error || 'Setup failed';
            errorEl.style.display = 'flex';
            btn.disabled = false;
            btn.textContent = 'Create Account & Continue';
        }
    } catch {
        errorEl.textContent = 'Network error — please try again';
        errorEl.style.display = 'flex';
        btn.disabled = false;
        btn.textContent = 'Create Account & Continue';
    }
});
