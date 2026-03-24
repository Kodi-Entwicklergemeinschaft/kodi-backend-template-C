const accessibilityTagsService = require("../services/accessibilityTags");

const getAllAccessibilityTags = async function (req, res, next) {
    try {
        const data = await accessibilityTagsService.getAllAccessibilityTags();
        res.status(200).json({
            status: "success",
            data
        });
    } catch (err) {
        return next(err);
    }
};

module.exports = { getAllAccessibilityTags };
