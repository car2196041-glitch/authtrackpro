const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    tls: {
        ciphers: "SSLv3",
    },
});

async function sendEmail({
    to,
    subject,
    html,
    fromName = process.env.EMAIL_FROM_NAME,
    fromAddress = process.env.EMAIL_FROM_ADDRESS,
}) {

    const mailOptions = {
        from: `"${fromName}" <${fromAddress}>`,
        to,
        subject,
        html,
    };

    return transporter.sendMail(mailOptions);
}

module.exports = {
    sendEmail,
};