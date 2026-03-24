const interestService = require('../services/interests');

const getAllInterests = async function (req, res, next) {
    try {
        const data = await interestService.getAllInterests();
        res.status(200).json({
            status: 'success',
            data
        });
    } catch (err) {
        return next(err);
    }
};

module.exports = { getAllInterests };
