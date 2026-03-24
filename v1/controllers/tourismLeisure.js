const tourismLeisureService = require("../services/tourismLeisure");

const getTourismLeisure = async function (req, res, next) {
    try {
        const translate = req.query.translate;
        const data = await tourismLeisureService.getTourismLeisure(translate);
        res.status(200).json({
            status: "success",
            data
        });
    } catch (err) {
        return next(err);
    }
};

module.exports = {
    getTourismLeisure
};
