const AppError = require("../utils/appError");
const feedbacksRepository = require("../repository/feedbacksRepo");
const sendMail = require("../utils/sendMail");

const getAllFeedbacks = async function ({ pageNo, pageSize }) {
    try {
        const feedbacks = await feedbacksRepository.getAll({
            pageNo,
            pageSize
        });
        return feedbacks.rows;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const submitFeedback = async function ({
    userEmail,
    title,
    description,
    language = "de"
}) {
    if (!userEmail || !title || !description) {
        throw new AppError("All fields are mandatory", 400);
    }

    if (language) {
        const validLanguages = ["en", "de"];
        if (!validLanguages.includes(language)) {
            throw new AppError("Invalid language", 400);
        }
    }
    if (userEmail &&  !/^[a-z0-9]+(\.[a-z0-9]+)*@[a-z0-9.-]+\.[a-z]{2,}$/i.test(userEmail)) {
        throw new AppError("Invalid email format", 400);
    }

    if (title && [...title].length > 100) {
        throw new AppError("Title should not exceed 100 characters", 400);
    }
    if (description && [...description].length > 300) {
        throw new AppError("Description should not exceed 300 characters", 400);
    }

    if (description && [...description].length < 10) {
        throw new AppError("Description should be at least 10 characters", 400);
    }

    const feedbackEmail = require(`../emailTemplates/${language}/userFeedback`);
    const { subject, body } = feedbackEmail(userEmail, title, description);
    const recipients = process.env.EMAIL_RECIPIENTS;

    try {
        await sendMail(recipients, subject, null, body);
        await feedbacksRepository.create({
            data: { userEmail, title, description }
        });
    } catch (err) {
        console.log(err);
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

module.exports = { getAllFeedbacks, submitFeedback };
