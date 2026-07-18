const { ConfidentialClientApplication } = require("@azure/msal-node");

const requiredEnvironmentVariables = [
    "MICROSOFT_TENANT_ID",
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_CLIENT_SECRET",
    "MICROSOFT_SENDER_EMAIL",
];

function validateConfiguration() {
    const missingVariables = requiredEnvironmentVariables.filter(
        (variableName) => !process.env[variableName]
    );

    if (missingVariables.length > 0) {
        throw new Error(
            `Missing Microsoft Graph environment variables: ${missingVariables.join(", ")}`
        );
    }
}

validateConfiguration();

const msalClient = new ConfidentialClientApplication({
    auth: {
        clientId: process.env.MICROSOFT_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    },
});

async function getAccessToken() {
    const tokenResponse = await msalClient.acquireTokenByClientCredential({
        scopes: ["https://graph.microsoft.com/.default"],
    });

    if (!tokenResponse?.accessToken) {
        throw new Error("Microsoft Graph did not return an access token.");
    }

    return tokenResponse.accessToken;
}

async function sendGraphEmail({
    to,
    subject,
    html,
    fromName = process.env.EMAIL_FROM_NAME || "AuthTrack Pro",
}) {
    if (!to || !subject || !html) {
        throw new Error("Email recipient, subject, and HTML content are required.");
    }

    const accessToken = await getAccessToken();
    const senderEmail = process.env.MICROSOFT_SENDER_EMAIL;

    const response = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
            senderEmail
        )}/sendMail`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: {
                    subject,
                    body: {
                        contentType: "HTML",
                        content: html,
                    },
                    toRecipients: [
                        {
                            emailAddress: {
                                address: to,
                            },
                        },
                    ],
                    from: {
                        emailAddress: {
                            address: senderEmail,
                            name: fromName,
                        },
                    },
                },
                saveToSentItems: true,
            }),
        }
    );

    if (!response.ok) {
        const errorDetails = await response.text();

        throw new Error(
            `Microsoft Graph email failed with status ${response.status}: ${errorDetails}`
        );
    }

    return {
        success: true,
        status: response.status,
    };
}

module.exports = {
    sendGraphEmail,
};