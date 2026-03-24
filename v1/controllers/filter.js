const filter = require("../services/filterService");

const filterList = async function (req, res, next) {
    try {
        const translate = req.query.translate;

        const result = await filter.filterList(translate);

        return res.status(200).json({
            status: "success",
            data: result
        });
    } catch (err) {
        return next(err);
    }
};


module.exports = {
    filterList
};