const favoritesService = require("../services/favorites");

const getAllFavoritesForUser = async function (req, res, next) {
    const userId = parseInt(req.userId);
    try {
        const data = await favoritesService.getAllFavoritesForUser(
            userId
        );
        res.status(200).json({
            status: "success",
            data,
        });
    } catch (err) {
        return next(err);
    }
};

const getFavoriteListingsForUser = async function (req, res, next) {
    try {
        const userId = parseInt(req.userId);
        const params = req.query;
        const {
            pageNo = 1,
            pageSize = 9,
            categoryId,
            cityId,
            translate,
            startAfterDate,
            endBeforeDate,
            dateFilter,
            centerLatitude,
            centerLongitude,
            radius,
        } = params;
        
        const data = await favoritesService.getFavoriteListingsForUser({
            userId,
            pageNo,
            pageSize,
            categoryId,
            cityId,
            translate,
            startAfterDate,
            endBeforeDate,
            dateFilter,
            centerLatitude,
            centerLongitude,
            radius,
        }
        );
        res.status(200).json({
            status: "success",
            data,
        });
    } catch (err) {
        return next(err);
    }
};

const getFavoriteCitiesForUser = async function (req, res, next) {
    try {
        const userId = parseInt(req.userId);
        const cityId = req.query.cityId ? parseInt(req.query.cityId) : undefined;
        const pageNo = req.query.pageNo || 1;
        const pageSize = req.query.pageSize || 10;
        const data = await favoritesService.getFavoriteCitiesForUser({
            userId,
            cityId,
            pageNo,
            pageSize
        });
        res.status(200).json({
            status: "success",
            data
        });
    } catch (err) {
        return next(err);
    }
};

const addNewFavoriteForUser = async function (req, res, next) {
    try {
        const userId = parseInt(req.userId);
        const cityId = parseInt(req.body.cityId);
        const listingId = req.body.listingId;

        const id = await favoritesService.addNewFavoriteForUser(
            userId,
            cityId,
            listingId,
        );
        res.status(200).json({
            status: "success",
            id,
        });
    } catch (err) {
        return next(err);
    }
};

const addNewFavoriteCityForUser = async function (req, res, next) {
    try {
        const userId = parseInt(req.userId);
        const cityId = parseInt(req.body.cityId);

        const id = await favoritesService.addNewFavoriteCityForUser(
            userId,
            cityId
        );
        res.status(200).json({
            status: "success",
            id
        });
    } catch (err) {
        return next(err);
    }
};

const deleteFavoriteListingForUser = async function (req, res, next) {
    try {
        const listingId = parseInt(req.params.listingId);
        const userId = parseInt(req.userId);
        await favoritesService.deleteFavoriteListingForUser(
            listingId,
            userId,
        );
        res.status(200).json({
            status: "success",
        });
    } catch (err) {
        return next(err);
    }
};

const deleteFavoriteCityForUser = async function (req, res, next) {
    try {
        const cityId = parseInt(req.params.cityId);
        const userId = parseInt(req.userId);
        await favoritesService.deleteFavoriteCityForUser(
            cityId,
            userId
        );
        res.status(200).json({
            status: "success"
        });
    } catch (err) {
        return next(err);
    }
};

module.exports = {
    addNewFavoriteForUser,
    getAllFavoritesForUser,
    getFavoriteListingsForUser,
    getFavoriteCitiesForUser,
    addNewFavoriteCityForUser,
    deleteFavoriteCityForUser,
    deleteFavoriteListingForUser,
};
