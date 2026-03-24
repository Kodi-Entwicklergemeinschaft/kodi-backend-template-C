const cityService = require("../services/cities");
const AppError = require("../utils/appError");
const supportedLanguages = require("../constants/supportedLanguages");
const { translateObjectValues } = require("../services/translationService");

async function translateMessage(obj, translate, fields = ['message']) {
    if (!translate || !supportedLanguages.includes(translate)) return;
    try { await translateObjectValues(obj, translate, fields); } catch (_) {}
}

async function translateError(err, translate) {
    if (!translate || !supportedLanguages.includes(translate)) return;
    try {
        const wrapper = { message: err.message };
        await translateObjectValues(wrapper, translate, ['message']);
        err.message = wrapper.message;
    } catch (_) {}
}

const getCities = async function (req, res, next) {
    const userId = req.userId;
    const type = req.query.type;
    const parentId = req.query.parentId;
    const pageNo = req.query.pageNo;
    const pageSize = req.query.pageSize;
    const searchQuery = req.query.searchQuery;
    const orderBy = req.query.orderBy || "name";
    const isDescending = req.query.isDescending === "true" ? true : false;

    let hasForum = false;
    if (req.query.hasForum) hasForum = true;

    try {
        const data = await cityService.getCities({ hasForum, type, parentId, userId, pageNo, pageSize, searchQuery, orderBy, isDescending });
        res.status(200).json({
            status: "success",
            data
        });
    } catch (err) {
        return next(err);
    }
};

const getCity = async function (req, res, next) {
    const cityId = req.params.id;
    const userId = req.userId;
    const translate = req.query.translate;

    try {
        const data = await cityService.getCity(cityId, userId, translate);
        res.status(200).json({
            status: "success",
            data
        });
    } catch (err) {
        return next(err);
    }
};


const updateCity = async (req, res, next) => {
    const cityId = Number(req.params.id);
    const userId = req.userId; // from JWT token set by authentication middleware
    const imageFile = req.files?.image;
    const mayorImage = req.files?.mayor_image;

    try {
        // Extract only allowed fields
        const { description, subtitle, mayor_name: mayorName, mayor_description: mayorDescription } = req.body;
        const cityData = { description, subtitle, mayorName, mayorDescription };

        const updateResult = await cityService.updateCity(
            cityId,
            cityData,
            userId,
            imageFile,
            mayorImage
        );

        res.status(200).json({
            status: "success",
            data: updateResult,
            id: Number(cityId)
        });
    } catch (err) {
        next(err);
    }
};

const assignCityAdmin = async (req, res, next) => {
    const cityId = Number(req.params.id);
    const targetUserId = Number(req.body.userId);
    const requestingUserId = req.userId;
    const translate = req.query.translate;

    if (!targetUserId) {
        const err = new AppError("userId is required in request body", 400);
        await translateError(err, translate);
        return next(err);
    }

    try {
        const result = await cityService.assignCityAdmin(requestingUserId, cityId, targetUserId);
        await translateMessage(result, translate);
        res.status(200).json({
            status: "success",
            data: result,
        });
    } catch (err) {
        await translateError(err, translate);
        return next(err);
    }
};

const removeCityAdmin = async (req, res, next) => {
    const cityId = Number(req.params.id);
    const targetUserId = Number(req.query.userId);
    const requestingUserId = req.userId;
    const translate = req.query.translate;

    if (!targetUserId) {
        const err = new AppError("userId is required as a query parameter", 400);
        await translateError(err, translate);
        return next(err);
    }

    try {
        const result = await cityService.removeCityAdmin(requestingUserId, cityId, targetUserId);
        await translateMessage(result, translate);
        res.status(200).json({
            status: "success",
            data: result,
        });
    } catch (err) {
        await translateError(err, translate);
        return next(err);
    }
};

const getCityAdmins = async (req, res, next) => {
    const cityId = Number(req.params.id);

    try {
        const admins = await cityService.getCityAdmins(cityId);
        res.status(200).json({
            status: "success",
            data: admins,
        });
    } catch (err) {
        return next(err);
    }
};

const getAdminCities = async (req, res, next) => {
    const { userId, roleId } = req;

    try {
        const cities = await cityService.getAdminCities(userId, roleId);
        res.status(200).json({
            status: "success",
            data: cities,
        });
    } catch (err) {
        return next(err);
    }
};

module.exports = {
    getCities,
    getCity,
    updateCity,
    assignCityAdmin,
    removeCityAdmin,
    getCityAdmins,
    getAdminCities,
};
