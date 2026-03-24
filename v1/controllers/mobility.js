const mobilityService = require("../services/mobility");

const getMobility = async function (req, res, next) {
    try {
        const { translate } = req.query;
        const data = await mobilityService.getMobility(translate);
        res.status(200).json({
            status: "success",
            data
        });
    } catch (err) {
        return next(err);
    }
};

module.exports = {
    getMobility
};
