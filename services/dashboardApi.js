
export async function sendSummaryToDashboard(payload) {
    const apiUrl = process.env.DASHBOARD_API_URL;
    const apiToken = process.env.DISCORD_SUMMARY_API_TOKEN;

    if (!apiUrl) {
        throw new Error('DASHBOARD_API_URL is not configured.');
    }

    if (!apiToken) {
        throw new Error('DISCORD_SUMMARY_API_TOKEN is not configured.');
    }

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify(payload)
    });

    const responseData = await response.json().catch(() => null);

    if (!response.ok) {
        const message = responseData?.message
            || `Dashboard API request failed (${response.status}).`;

        const errors = responseData?.errors
            ? JSON.stringify(responseData.errors)
            : '';

        throw new Error(errors ? `${message} ${errors}` : message);
    }

    return responseData;
}
