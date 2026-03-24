const moreInfoService = require("../services/moreInfos");

const getMoreInfo = async function (req, res, next) {
    const queryLanguage = req.query.language;
    try {
        const data = await moreInfoService.getMoreInfo(queryLanguage);
        res.status(200).json({
            status: "success",
            data,
        });
    } catch (err) {
        return next(err);
    }
};

const getLegalContent = async function (req, res, next) {
    const { type } = req.params;
    const translate = req.query.translate;
    
    try {
        const data = await moreInfoService.getLegalContent(type, translate);
        res.status(200).json({
            status: "success",
            data,
        });
    } catch (err) {
        return next(err);
    }
};

module.exports = {
    getMoreInfo,
    getLegalContent,
};
