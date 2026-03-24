module.exports = function (userEmail, title, description) {
    return {
        subject: `New User Feedback: ${title}`,
        body: `<h1>Feedback</h1>
                <p><strong>Submitted by:</strong> ${userEmail}</p>
                <p><strong>Regarding:</strong> ${title}</p>
                <p><strong>Description:</strong><br>${description}</p>
                <p>Please reply directly to ${userEmail} to address this feedback.</p>
                <br>
                <p>Thank you,<br>
                Heidi Team</p>`
    };
};
