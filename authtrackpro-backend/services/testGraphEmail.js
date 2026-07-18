require("dotenv").config();

const { sendGraphEmail } = require("./graphEmailService");

async function testGraphEmail() {
    try {
        const recipient =
            process.env.TEST_EMAIL_TO ||
            process.env.MICROSOFT_SENDER_EMAIL;

        console.log(`Sending Microsoft Graph test email to ${recipient}...`);

        const result = await sendGraphEmail({
            to: recipient,
            subject: "AuthTrack Pro Microsoft Graph Test",
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <h2>Microsoft Graph Email Test Successful</h2>
                    <p>
                        AuthTrack Pro successfully sent this email through
                        Microsoft Graph and Microsoft 365.
                    </p>
                    <p>
                        This confirms that the enterprise email service is connected.
                    </p>
                </div>
            `,
        });

        console.log("Graph email request accepted:", result);
        process.exit(0);
    } catch (error) {
        console.error("Graph email test failed:");
        console.error(error.message);
        process.exit(1);
    }
}

testGraphEmail();