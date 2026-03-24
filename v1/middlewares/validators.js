const AppError = require('../utils/appError');

const validateCityId = (req, res, next) => {
    const cityId = req.params.cityId;
    if (isNaN(Number(cityId)) || Number(cityId) <= 0)
        return next(new AppError(`Invalid city id given`, 400));
    req.cityId = cityId;
    next();
};

const validateUserId = (req, res, next) => {
    const userId = req.params.userId;
    if (isNaN(Number(userId)) || Number(userId) <= 0)
        return next(new AppError(`Invalid user id given`, 400));
    req.paramUserId = userId;
    next();
};

module.exports = { validateCityId, validateUserId };
