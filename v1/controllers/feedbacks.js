const feedbackService = require("../services/feedbacks");

const getAllFeedbacks = async function (req, res, next) {
    const params = req.query;
    const roleId = req.roleId;
    const { pageNo = 1, pageSize = 9 } = params;

    const isAdmin = roleId === 1;

    if (!isAdmin) {
        return res.status(403).json({
            status: "error",
            message: "You do not have permission to access this resource."
        });
    }

    try {
        const data = await feedbackService.getAllFeedbacks({
            pageNo,
            pageSize
        });
        res.status(200).json({
            status: "success",
            data
        });
    } catch (err) {
        return next(err);
    }
};

const submitFeedback = async function (req, res, next) {
    try {
        const { userEmail, title, description, language } = req.body;

        await feedbackService.submitFeedback({
            userEmail,
            title,
            description,
            language
        });
        res.status(200).json({
            status: "success",
            message: "Feedback submitted successfully"
        });
    } catch (err) {
        return next(err);
    }
};

module.exports = { getAllFeedbacks, submitFeedback };
