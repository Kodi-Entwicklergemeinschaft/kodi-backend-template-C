module.exports = function (language) {
    return {
        subject: "You are invited",
        body: `<h1>You've been invited!</h1>
               <p>Click the link below to create your account:<br>
               <a href="${process.env.WEBSITE_DOMAIN}/signup" target="_blank" rel="noopener noreferrer">Register here</a>
               <br><br>
               Please register using the email address this invitation was sent to.<br>
               Thank you,<br>
               The ${process.env.REGION} Team</p>`,
    };
};
