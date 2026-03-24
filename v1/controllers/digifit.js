const digifitService = require("../services/digifitService");

const fitStats = async function (req, res, next) {
    try {
        const userId = req.userId;
        const translate = req.query.translate;

        // Delegate heavy lifting to service layer
        const responseData = await digifitService.getFitStats(userId, translate);

        return res.status(200).json({
            data: responseData,
            status: "Fitness track details fetched successfully"
        });
    } catch (err) {
        return next(err);
    }
};

const userEquipmentStats = async function (req, res, next) {
    try {
        const userId = req.userId;
        const locationId = req.params.locationId;
        const translate = req.query.translate;

        // Delegate heavy lifting to service layer
        const responseData = await digifitService.getUserEquipmentStats(userId, locationId, translate);
        return res.status(200).json({
            data: responseData,
            status: "User Equipment status fetched successfully"
        });
    } catch (err) {
        return next(err);
    }
};

const exerciseDetails = async function (req, res, next) {
    try {
        const userId = req.userId;
        const { equipmentId, locationId, equipmentSlug } = req.query;
        const translate = req.query.translate;

        // Delegate business logic to service layer
        const responseData = await digifitService.getExerciseDetails(
            userId,
            { equipmentId, locationId, equipmentSlug },
            translate
        );
        return res.status(200).json({
            data: responseData,
            status: "Exercise details fetched successfully"
        });
    } catch (err) {
        return next(err);
    }
};

const markFavourite = async function (req, res, next) {
    try {
        const userId = req.userId;
        const { isFavorite, equipmentId, locationId } = req.body;

        // Delegate to service layer
        const result = await digifitService.markFavourite(
            userId,
            equipmentId,
            locationId,
            isFavorite
        );

        return res.status(200).json({
            status: "Favorite status updated successfully",
            data: result
        });
    } catch (err) {
        return next(err);
    }
};

const tracker = async function (req, res, next) {
    try {
        const userId = req.userId;
        const responseData = await digifitService.tracker(userId, req.body);
        return res.status(200).json(responseData);
    } catch (err) {
        return next(err);
    }
};

const offlineFitStats = async function (req, res, next) {
    try {
        return await digifitService.offlineFitStats(req, res, next);
    } catch (err) {
        return next(err);
    }
};

const bulkTrackers = async function (req, res, next) {
    try {
        return await digifitService.bulkTrackers(req, res, next);
    } catch (err) {
        return next(err);
    }
};

const userTrophies = async function (req, res, next) {
    try {
        return await digifitService.userTrophies(req, res, next);
    } catch (err) {
        return next(err);
    }
};

const gamingList = async function (req, res, next) {
    try {
        const responseData = await digifitService.gamingList(req, next);
        return res.status(200).json({
            data: responseData,
            status: "Gaming list fetched successfully"
        });
    } catch (err) {
        console.log(err)
        return next(err);
    }
};

const gameDetails = async function (req, res, next) {
    try {
        const responseData = await digifitService.gameDetails(req, next);
        return res.status(200).json({
            data: responseData,
            status: "Game details fetched successfully"
        });
    } catch (err) {
        return next(err);
    }
};

const gameSteps = async function (req, res, next) {
    try {
        const responseData = await digifitService.gameSteps(req, next);
        return res.status(200).json({
            data: responseData,
            status: "Game steps fetched successfully"
        });
    } catch (err) {
        return next(err);
    }
};

const gamesTracker = async function (req, res, next) {
    try {
        const responseData = await digifitService.gameTracker(req, next);
        return res.status(200).json({
            data: responseData,
            status: "Games tracker fetched successfully"
        });
    } catch (err) {
        return next(err);
    }
};

const favoritesEquipments =  async function (req, res, next) {
    try {
        const userId = parseInt(req.userId);
        const translate = req.query.translate || '';
        const locationIds = req.query.location || []
        const pageNo = req.query.pageNo || 1;
        const pageSize = req.query.pageSize || 10;
        const data = await digifitService.favoritesEquipments(
            userId,
            translate,
            locationIds,
            pageNo,
            pageSize
        );
        res.status(200).json({
            status: "success",
            data,
        });
    } catch (err) {
        return next(err);
    }
};


module.exports = {
    fitStats,
    userEquipmentStats,
    exerciseDetails,
    markFavourite,
    tracker,
    userTrophies,
    offlineFitStats,
    bulkTrackers,
    gamingList,
    gameDetails,
    gameSteps,
    gamesTracker,
    favoritesEquipments
};
