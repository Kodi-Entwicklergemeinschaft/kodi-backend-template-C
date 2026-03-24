module.exports = function (userEmail, title, description) {
    return {
        subject: `Neues Benutzerfeedback: ${title}`,
        body: `<h1>Feedback</h1>
                <p><strong>Eingereicht von:</strong> ${userEmail}</p>
                <p><strong>Betreff:</strong> ${title}</p>
                <p><strong>Beschreibung:</strong><br>${description}</p>
                <p>Bitte antworten Sie direkt an ${userEmail}, um dieses Feedback zu bearbeiten.</p>
                <br>
                <p>Vielen Dank,<br>
                Heidi Team</p>`
    };
};
