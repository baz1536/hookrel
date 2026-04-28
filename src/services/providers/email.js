const nodemailer = require('nodemailer');
const { ClientSecretCredential } = require('@azure/identity');
const { Client } = require('@microsoft/microsoft-graph-client');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');
const { decrypt } = require('../encryption');

async function sendSmtp(config, subject, body, isHtml = true) {
    const { smtp, recipients, cc, bcc } = config;
    if (!smtp) throw new Error('SMTP configuration missing');

    const transportConfig = {
        host: smtp.host,
        port: smtp.port || 587,
        secure: smtp.security === 'ssl',
        requireTLS: smtp.security === 'starttls',
        auth: smtp.username ? {
            user: smtp.username,
            pass: decrypt(smtp.password),
        } : undefined,
        tls: smtp.ignoreTLS ? { rejectUnauthorized: false } : undefined,
    };

    const transporter = nodemailer.createTransport(transportConfig);

    const fromStr = smtp.fromName ? `"${smtp.fromName}" <${smtp.from}>` : smtp.from;

    await transporter.sendMail({
        from: fromStr,
        to: recipients,
        cc: cc || undefined,
        bcc: bcc || undefined,
        subject,
        [isHtml ? 'html' : 'text']: body,
    });
}

async function sendMsgraph(config, subject, body, isHtml = true) {
    const { msgraph, recipients, cc, bcc } = config;
    if (!msgraph) throw new Error('Microsoft Graph configuration missing');

    const credential = new ClientSecretCredential(
        msgraph.tenantId,
        msgraph.clientId,
        decrypt(msgraph.clientSecret),
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
        scopes: ['https://graph.microsoft.com/.default'],
    });

    const client = Client.initWithMiddleware({ authProvider });

    const toRecipients = parseAddresses(recipients);
    const ccRecipients = parseAddresses(cc);
    const bccRecipients = parseAddresses(bcc);

    const message = {
        subject,
        body: { contentType: isHtml ? 'HTML' : 'Text', content: body },
        toRecipients,
        ...(ccRecipients.length && { ccRecipients }),
        ...(bccRecipients.length && { bccRecipients }),
    };

    await client.api(`/users/${msgraph.from}/sendMail`).post({ message });
}

function parseAddresses(str) {
    if (!str) return [];
    return str.split(',').map(a => a.trim()).filter(Boolean).map(a => ({
        emailAddress: { address: a },
    }));
}

module.exports = { sendSmtp, sendMsgraph };
