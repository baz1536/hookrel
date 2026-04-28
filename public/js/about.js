export async function loadAboutInfo() {
    const infoEl = document.getElementById('about-info');
    if (!infoEl) return;
    infoEl.innerHTML = '<p class="loading">Loading application information…</p>';

    try {
        const res = await fetch('/api/about');
        const info = await res.json();
        const env = info.environment || {};

        let html = `
        <div class="about-tech-grid">
          <div class="card about-tech-card">
            <h2 class="about-tech-title">Application</h2>
            <div class="about-kv">
              <span class="about-k">Version</span>
              <span class="about-v"><span class="badge badge-accent">v${info.version}</span></span>
            </div>
            <div class="about-kv">
              <span class="about-k">Node.js</span>
              <span class="about-v">${info.nodeVersion || 'Unknown'}</span>
            </div>
            <div class="about-kv">
              <span class="about-k">npm</span>
              <span class="about-v">${info.npmVersion || 'Unknown'}</span>
            </div>
            ${info.gitBranch && info.gitBranch !== 'main' && info.gitBranch !== 'master' ? `
            <div class="about-kv">
              <span class="about-k">Git branch</span>
              <span class="about-v"><code>${info.gitBranch}</code></span>
            </div>` : ''}
          </div>

          <div class="card about-tech-card">
            <h2 class="about-tech-title">Environment</h2>
            <div class="about-kv">
              <span class="about-k">Hostname</span>
              <span class="about-v">${env.hostname || 'Unknown'}</span>
            </div>
            <div class="about-kv">
              <span class="about-k">Address</span>
              <span class="about-v">${
                env.ipAddresses?.length
                    ? env.ipAddresses.map(ip => `${ip}:${env.port}`).join(', ')
                    : `localhost:${env.port || 3551}`
              }</span>
            </div>
            <div class="about-kv">
              <span class="about-k">OS</span>
              <span class="about-v">${env.distro || env.os || 'Unknown'}</span>
            </div>
            <div class="about-kv">
              <span class="about-k">Architecture</span>
              <span class="about-v">${env.architecture || 'Unknown'}</span>
            </div>
            <div class="about-kv">
              <span class="about-k">Docker</span>
              <span class="about-v">${env.isDocker
                ? '<span class="badge badge-success">Yes</span>'
                : '<span class="badge badge-muted">No</span>'}</span>
            </div>
            <div class="about-kv">
              <span class="about-k">Database</span>
              <span class="about-v">${env.dbType === 'mongodb' ? 'MongoDB' : 'SQLite'}</span>
            </div>
          </div>
        </div>`;

        const tiptapVersion = (info.devDependencies || {})['@tiptap/core'] || '';
        const tiptapVer = tiptapVersion.replace(/^\^/, '');

        if (info.dependencies && Object.keys(info.dependencies).length) {
            html += `
        <div class="card about-deps-card">
          <h2 class="about-tech-title">Dependencies</h2>
          <table class="about-deps-table">
            <thead><tr><td>Package</td><td>Version</td></tr></thead>
            <tbody>
              ${Object.entries(info.dependencies).sort().map(([pkg, ver]) =>
                `<tr><td>${pkg}</td><td>${ver}</td></tr>`
              ).join('')}
              <tr><td>TipTap (core + extensions) <span class="about-dep-note">bundled</span></td><td>${tiptapVer}</td></tr>
            </tbody>
          </table>
        </div>`;
        }

        html += `
        <div class="card about-licenses-card">
          <h2 class="about-tech-title">Third-Party Licenses</h2>
          <p class="about-licenses-intro">HookRel is built on open source software. The following packages are included:</p>
          <table class="about-deps-table">
            <thead><tr><td>Package</td><td>License</td><td>Copyright</td></tr></thead>
            <tbody>
              <tr><td>@azure/identity</td><td>MIT</td><td>Microsoft Corp.</td></tr>
              <tr><td>@microsoft/microsoft-graph-client</td><td>MIT</td><td>Microsoft Corp.</td></tr>
              <tr><td>bcryptjs</td><td>MIT</td><td>Daniel Wirtz</td></tr>
              <tr><td>connect-mongo</td><td>MIT</td><td>Jared Hanson et al.</td></tr>
              <tr><td>express</td><td>MIT</td><td>TJ Holowaychuk</td></tr>
              <tr><td>express-session</td><td>MIT</td><td>TJ Holowaychuk</td></tr>
              <tr><td>global-agent</td><td>BSD-3-Clause</td><td>Gajus Kuizinas</td></tr>
              <tr><td>mongodb</td><td>Apache-2.0</td><td>MongoDB Inc.</td></tr>
              <tr><td>multer</td><td>MIT</td><td>Express contributors</td></tr>
              <tr><td>nodemailer</td><td>MIT</td><td>Andris Reinman</td></tr>
              <tr><td>ProseMirror</td><td>MIT</td><td>Marijn Haverbeke</td></tr>
              <tr><td>TipTap (core + extensions)</td><td>MIT</td><td>Tiptap GmbH</td></tr>
              <tr><td>winston</td><td>MIT</td><td>Charlie Robbins</td></tr>
            </tbody>
          </table>
          <p class="about-licenses-note">All other dependencies are licensed under MIT, ISC, BSD, or similarly permissive licenses.</p>
        </div>

        <div class="about-copyright">
          <p>Copyright &copy; ${new Date().getFullYear()} dBR Promotions. All rights reserved.</p>
        </div>`;

        infoEl.innerHTML = html;
    } catch {
        infoEl.innerHTML = '<p class="loading">Failed to load application information.</p>';
    }
}
