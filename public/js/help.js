window._help = {

dashboard: `
<h3>Overview</h3>
<p>The Dashboard gives you a live snapshot of HookRel activity — webhook traffic, notification delivery, and system health.</p>
<h3>Stat Cards</h3>
<ul>
  <li><strong>Sources / Providers / Templates / Rules</strong> — total configured items.</li>
  <li><strong>Webhooks (24h)</strong> — inbound webhooks received in the last 24 hours.</li>
  <li><strong>Notifications (24h)</strong> — outbound notifications dispatched in the last 24 hours.</li>
  <li><strong>Errors (24h)</strong> — failed deliveries in the last 24 hours.</li>
</ul>
<h3>Activity Feed</h3>
<p>Shows the most recent webhook and notification events. Click Refresh to update manually — the page also refreshes automatically every 30 seconds.</p>
<div class="help-tip">If errors are appearing, go to <strong>Logs</strong> for full detail on what failed and why.</div>
`,

sources: `
<h3>What is a Source?</h3>
<p>A source represents an application that sends webhooks to HookRel — for example Sonarr, Radarr, or Gitea. Each source gets its own unique URL and bearer token.</p>
<h3>Creating a Source</h3>
<ol style="padding-left:18px;margin-bottom:10px">
  <li>Click <strong>+ New Source</strong>.</li>
  <li>Enter a name and choose the application type.</li>
  <li>Click <strong>Save Source</strong>.</li>
  <li>Copy the Webhook URL and Token shown in the Connection Details panel.</li>
</ol>
<h3>Webhook URL</h3>
<p>Configure your application to POST to this URL. The base URL is set via the <code>PUBLIC_URL</code> environment variable.</p>
<h3>Authentication</h3>
<p>Send the token as either:</p>
<ul>
  <li><code>Authorization: Bearer &lt;token&gt;</code></li>
  <li><code>X-API-Key: &lt;token&gt;</code></li>
</ul>
<h3>Rotate Token</h3>
<p>If a token is compromised, click <strong>Rotate</strong> to generate a new one immediately. The old token stops working right away.</p>
<h3>Test Payload Parser</h3>
<p>Paste a sample JSON payload and click <strong>Parse Payload</strong> to see what event type and tokens HookRel would extract — useful when building templates.</p>
<h3>Custom Sources &amp; Live Token Learning</h3>
<p>When the application type is set to <strong>Custom</strong>, HookRel automatically learns the available tokens from real incoming payloads. There is nothing to configure — just send a webhook (e.g. a test event from your application) and HookRel will record every field it sees.</p>
<p>Once tokens have been learned, open a Message Template and select the custom source — the token hints panel will show all discovered tokens as clickable chips, ready to insert into your template.</p>
<div class="help-tip">Tokens accumulate over time. Sending events of different types will add more tokens to the hints panel.</div>
`,

providers: `
<h3>What is a Provider?</h3>
<p>A provider is a notification delivery channel — where HookRel sends the notification when a rule fires.</p>

<h3>SMTP (Email)</h3>
<p>Send email via any standard mail server. Works with Gmail, Outlook, self-hosted Postfix/Exim, and others.</p>
<ul>
  <li><strong>Security</strong> — <em>STARTTLS</em> (port 587, upgrades to TLS mid-connection) is the modern standard. <em>SSL/TLS</em> (port 465) uses TLS from the start. <em>None</em> sends unencrypted — only use on a trusted internal network.</li>
  <li><strong>Ignore TLS errors</strong> — bypasses certificate validation. Use only for self-signed certs on internal servers — never on public servers.</li>
  <li><strong>From Address</strong> — must match the authenticated user for most providers (Gmail, Office 365).</li>
</ul>

<h3>Microsoft Graph (Email)</h3>
<p>Send email via Microsoft 365 using an Entra ID (Azure AD) app registration. Requires an app with <code>Mail.Send</code> application permission granted by an admin.</p>
<ul>
  <li><strong>Tenant ID</strong> — found in Entra ID → Overview.</li>
  <li><strong>Client ID</strong> — the Application (client) ID of your app registration.</li>
  <li><strong>Client Secret</strong> — created under the app registration → Certificates &amp; secrets.</li>
  <li><strong>From Address</strong> — the mailbox the email is sent from (must exist in your tenant).</li>
</ul>

<h3>Telegram</h3>
<p>Send messages to a Telegram chat, group, or channel via a bot.</p>
<ul>
  <li><strong>Bot Token</strong> — message <code>@BotFather</code> on Telegram, send <code>/newbot</code>, and copy the token provided.</li>
  <li><strong>Chat ID</strong> — add your bot to the target chat, then message <code>@userinfobot</code> in that chat to get the ID. Group/channel IDs start with <code>-100</code>.</li>
</ul>

<h3>Pushover</h3>
<p>Send push notifications to iOS and Android via the Pushover app.</p>
<ul>
  <li><strong>API Token</strong> — log in at <code>pushover.net</code>, go to <em>Your Applications</em>, create an application, and copy its token.</li>
  <li><strong>User Key</strong> — shown on the main Pushover dashboard (top right, starts with <code>u</code>).</li>
  <li><strong>Priority</strong> — Low, Normal, or High. High bypasses quiet hours on the device.</li>
  <li><strong>Device</strong> — optional device name to target a single device. Leave blank to deliver to all registered devices.</li>
</ul>

<h3>Discord</h3>
<p>Post messages to a Discord channel via an incoming webhook.</p>
<ul>
  <li><strong>Webhook URL</strong> — in Discord open the channel → Settings → Integrations → Webhooks → New Webhook. Copy the URL.</li>
</ul>

<h3>Slack</h3>
<p>Post messages to a Slack channel via an incoming webhook.</p>
<ul>
  <li><strong>Webhook URL</strong> — go to <code>api.slack.com/apps</code>, create an app, enable <em>Incoming Webhooks</em>, and add a webhook to your workspace.</li>
</ul>

<h3>Gotify</h3>
<p>Send push notifications to a self-hosted Gotify server.</p>
<ul>
  <li><strong>Server URL</strong> — the base URL of your Gotify instance (e.g. <code>https://gotify.example.com</code>).</li>
  <li><strong>App Token</strong> — in Gotify go to <em>Apps</em>, create a new application, and copy its token.</li>
  <li><strong>Priority</strong> — 0–10. Higher values show as more urgent in the Gotify app.</li>
</ul>

<h3>ntfy</h3>
<p>Send notifications via ntfy — works with the public <code>ntfy.sh</code> server or a self-hosted instance.</p>
<ul>
  <li><strong>Server URL</strong> — use <code>https://ntfy.sh</code> for the public server or your own instance URL.</li>
  <li><strong>Topic</strong> — the notification channel name. Anyone who knows the topic can subscribe, so use something unguessable on the public server.</li>
  <li><strong>Token</strong> — only required if your ntfy server has access control enabled.</li>
</ul>

<h3>Microsoft Teams</h3>
<p>Post messages to a Teams channel via a Power Automate workflow webhook.</p>
<ul>
  <li><strong>Webhook URL</strong> — in Teams, open the channel → click <em>···</em> → <em>Workflows</em> → search for <em>"Post to a channel when a webhook request is received"</em> → follow the prompts and copy the URL at the end.</li>
</ul>

<h3>HTML vs Plain Text</h3>
<p>SMTP and Microsoft Graph support HTML templates. All other providers (Telegram, Pushover, Discord, Slack, Gotify, ntfy, Teams) receive plain text. HookRel automatically uses the correct body from the template based on the provider type — no manual switching needed.</p>

<h3>Test Notification</h3>
<p>Click <strong>Send Test Notification</strong> after saving a provider to verify your credentials and configuration are correct.</p>
<div class="help-tip">Sensitive fields (passwords, tokens, secrets) are encrypted at rest using AES-256-GCM. They are masked as ●●●●●●●● in the UI — entering a new value replaces it, leaving the field blank keeps the existing value.</div>
`,

templates: `
<h3>What is a Template?</h3>
<p>A template defines the message body (and optional subject) sent when a rule fires. Templates support <code>{{token.path}}</code> placeholders that are replaced with values from the incoming webhook payload.</p>
<h3>Token Syntax</h3>
<ul>
  <li><code>{{series.title}}</code> — inserts the value at that path.</li>
  <li><code>{{release.quality | Unknown}}</code> — inserts the value, or "Unknown" if missing.</li>
  <li><code>{{episodes[0].seasonNumber | ?}}</code> — first element of an array.</li>
</ul>
<h3>HTML Body vs Plain Text Body</h3>
<p>Templates have two independent body fields:</p>
<ul>
  <li><strong>HTML Body</strong> — used by email providers (SMTP, Microsoft Graph). Has a full rich text editor with formatting, tables, and colour.</li>
  <li><strong>Plain Text Body</strong> — used by Telegram, Pushover, Discord, Slack, Gotify, ntfy, and Teams. A plain textarea supporting <code>{{token}}</code> syntax.</li>
</ul>
<p>You can populate one or both. HookRel automatically picks the correct body based on the provider type, falling back to the other if only one is filled.</p>
<h3>Rich Editor Toolbar</h3>
<ul>
  <li><strong>B I U S</strong> — bold, italic, underline, strikethrough.</li>
  <li><strong>H1 H2 H3</strong> — headings.</li>
  <li><strong>• List / 1. List</strong> — bullet and numbered lists.</li>
  <li><strong>⊞ Table</strong> — insert a 3×3 table. Use +Row/+Col/-Row/-Col to adjust.</li>
  <li><strong>A▪ / ▓▪</strong> — text colour and background fill colour pickers.</li>
</ul>
<h3>Token Hints</h3>
<p>Select a source to see available tokens for that application type. Click a token chip to insert it at the cursor position.</p>
<h3>Preview</h3>
<p>Click <strong>👁 Preview</strong> to render the template with sample values substituted for each token.</p>
<div class="help-tip">Templates are optional in rules — if no template is assigned, the raw JSON payload is sent.</div>
`,

rules: `
<h3>Overview</h3>
<p>Rules determine which provider receives a notification when a webhook arrives. Rules are organised into <strong>Groups</strong> — you must create at least one group before adding rules.</p>

<h3>Groups</h3>
<p>Groups are the top-level organiser. Each group has its own settings and contains one or more rules.</p>
<ul>
  <li><strong>Name &amp; Description</strong> — label the group so you can identify its purpose at a glance.</li>
  <li><strong>Match Mode</strong> — controls how rules within the group fire when a webhook matches:
    <ul style="margin-top:4px">
      <li><em>All matching rules fire</em> — every rule in the group that matches the incoming webhook is dispatched.</li>
      <li><em>First matching rule only</em> — rules are evaluated top-to-bottom; only the first match fires. Use this for priority fallback chains.</li>
    </ul>
  </li>
  <li><strong>Active toggle</strong> — disable a group to skip all of its rules during dispatch without deleting them. The toggle is in the Group Settings accordion header and saves immediately.</li>
</ul>
<div class="help-tip">Groups are independent — disabling one group has no effect on other groups. All active groups are evaluated for every incoming webhook.</div>

<h3>Creating a Group</h3>
<ol style="padding-left:18px;margin-bottom:10px">
  <li>Click <strong>+ New Group</strong> in the left panel.</li>
  <li>Enter a name, optional description, and choose a match mode.</li>
  <li>Click <strong>Save Group</strong>.</li>
</ol>

<h3>Rules</h3>
<p>Each rule belongs to a group and connects a source to a provider with optional filtering and a message template.</p>
<ul>
  <li><strong>Rule Name</strong> — a label to identify this rule in lists and logs.</li>
  <li><strong>Source</strong> — limit the rule to webhooks from a specific source, or leave blank to match any source.</li>
  <li><strong>Event Type</strong> — match a specific event (e.g. <code>Download</code>, <code>Grab</code>), use <code>*</code> to match all events, or leave blank (same as <code>*</code>).</li>
  <li><strong>Provider</strong> — required. The notification channel to send to when this rule fires.</li>
  <li><strong>Message Template</strong> — optional. Formats the message using token placeholders. If left blank, the raw JSON payload is sent.</li>
  <li><strong>Active toggle</strong> — the toggle in the rule row header enables or disables the rule instantly without opening the editor.</li>
</ul>

<h3>Creating a Rule</h3>
<ol style="padding-left:18px;margin-bottom:10px">
  <li>Select a group in the left panel.</li>
  <li>Click <strong>+ New Rule</strong> in the Rules accordion header.</li>
  <li>Fill in the name, source, event type, and provider.</li>
  <li>Optionally add conditions and a message template.</li>
  <li>Click <strong>Save Rule</strong>.</li>
</ol>

<h3>Editing a Rule</h3>
<p>Click anywhere on a rule row (except the toggle) to open the edit form inline within that rule. Click the row again or click <strong>✕</strong> to close without saving.</p>

<h3>Rule Order &amp; Priority</h3>
<p>Rules within a group are evaluated in top-to-bottom order. Drag the <strong>⠿</strong> handle on the left of any rule row to reorder. Order only matters when the group's match mode is set to <em>First matching rule only</em>.</p>

<h3>Conditions</h3>
<p>Conditions let you filter within a matching event — for example, only fire when a specific show or quality matches.</p>
<ul>
  <li>Click <strong>+ Add Condition</strong> to add a field/operator/value row.</li>
  <li><strong>Field</strong> — the token path from the payload (e.g. <code>series.title</code>, <code>release.quality</code>).</li>
  <li><strong>Operator</strong> — equals, not equals, contains, does not contain, starts with, ends with, is empty, is not empty.</li>
  <li><strong>Value</strong> — the value to compare against (not required for is empty / is not empty).</li>
  <li>When more than one condition is added, choose <strong>ALL (AND)</strong> or <strong>ANY (OR)</strong> matching.</li>
</ul>
<div class="help-tip">Use conditions to route specific shows, qualities, or event subtypes to different providers — e.g. send 4K downloads to one channel and HD to another.</div>

<h3>Dry Run</h3>
<p>Open the edit form for a rule and click <strong>🧪 Dry Run</strong> to simulate which rules would fire for the selected source and event type — without sending any actual notifications. Useful for verifying your group/condition setup before going live.</p>

<h3>Templates &amp; Body Format</h3>
<p>Templates have both an <strong>HTML body</strong> (used for email providers — SMTP, Microsoft Graph) and a <strong>Plain Text body</strong> (used for Telegram, Pushover, Discord, Slack, Gotify, ntfy, Teams). HookRel automatically picks the correct body based on the provider type, with fallback to the other if only one is populated.</p>
<div class="help-tip">Duplicate a rule using the <strong>Duplicate</strong> button in the edit form to quickly create variations with different providers or templates.</div>
`,

logs: `
<h3>Log Types</h3>
<ul>
  <li><strong>System</strong> — application startup, errors, and internal events.</li>
  <li><strong>Inbound</strong> — every webhook received, with the raw payload and parsed event type.</li>
  <li><strong>Outbound</strong> — every notification dispatched, with status and any error detail.</li>
</ul>
<h3>Filtering</h3>
<p>Use the search and filter controls to narrow down entries by source, provider, status, or date range.</p>
<h3>Retention</h3>
<p>Logs older than the configured retention period are automatically deleted each day. The retention period is set in <strong>Settings → Log &amp; Data Retention</strong>.</p>
<div class="help-tip">If a notification failed, check the Outbound log entry — it shows the exact error returned by the provider.</div>
`,

settings: `
<h3>Log &amp; Data Retention</h3>
<p>Sets how many days of inbound/outbound log entries to keep. Entries older than this are deleted automatically each night.</p>
<h3>Encryption Status</h3>
<p>Shows whether an encryption key is configured and how many provider credentials are encrypted at rest. Set <code>ENCRYPTION_KEY</code> in your <code>.env</code> file to enable encryption.</p>
<h3>Change Password</h3>
<p>Changes the password for your current account. Requires your existing password.</p>
<h3>User Management</h3>
<p>Create and manage user accounts. Two roles are available:</p>
<ul>
  <li><strong>Admin</strong> — full access to all configuration pages.</li>
  <li><strong>User</strong> — dashboard and read-only access only.</li>
</ul>
<div class="help-tip">Authentication can be disabled entirely by setting <code>AUTH_ENABLED=false</code> in your environment — useful for trusted internal networks.</div>
`,

};
