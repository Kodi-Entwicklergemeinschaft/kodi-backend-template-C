module.exports = function (language) {
    return {
        subject: "Sie sind eingeladen",
        body: `<h1>Sie wurden eingeladen!</h1>
               <p>Klicken Sie auf den Link unten, um Ihr Konto zu erstellen:<br>
               <a href="${process.env.WEBSITE_DOMAIN}/signup" target="_blank" rel="noopener noreferrer">Hier registrieren</a>
               <br><br>
               Bitte registrieren Sie sich mit der E-Mail-Adresse, an die diese Einladung gesendet wurde.<br>
               Vielen Dank,<br>
               Das ${process.env.REGION}-Team</p>`,
    };
};
