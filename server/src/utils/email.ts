export async function sendEmail(env: Env, to: string, subject: string, text: string): Promise<void> {
    const resendUrl = env.EMAIL_RESEND_URL;
    const resendPass = env.EMAIL_RESEND_PASS;

    if (!resendUrl || !resendPass) {
        throw new Error('Email service is not configured: EMAIL_RESEND_URL and EMAIL_RESEND_PASS are required');
    }

    const resp = await fetch(resendUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            to,
            subject,
            text,
            pass: resendPass,
        }),
    });

    if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`Email service error ${resp.status}: ${errText}`);
    }
}