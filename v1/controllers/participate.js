const participateService = require("../services/participate");

const getParticipate = async function (req, res, next) {
    try {
        const { translate } = req.query;

        const data = await participateService.getParticipate(translate);
        res.status(200).json({
            status: "success",
            data
        });
    } catch (err) {
        return next(err);
    }
};

module.exports = {
    getParticipate
};
