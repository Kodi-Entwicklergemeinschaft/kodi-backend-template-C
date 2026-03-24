const meinOrtService = require("../services/meinOrt");

const getMeinOrt = async function (req, res, next) {
    try {
        const userId = req.userId;
        const data = await meinOrtService.getMeinOrt(userId);
        res.status(200).json({
            status: "success",
            data
        });
    } catch (err) {
        return next(err);
    }
};

module.exports = {
    getMeinOrt
};
