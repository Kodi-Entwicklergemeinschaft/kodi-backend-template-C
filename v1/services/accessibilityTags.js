const AppError = require("../utils/appError");
const accessibilityTagsRepository = require("../repository/accessibilityTagsRepo");

const getAllAccessibilityTags = async function () {
    try {
        const accessibilityTags = await accessibilityTagsRepository.getAll({});
        return accessibilityTags.rows;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

module.exports = {
    getAllAccessibilityTags
};
