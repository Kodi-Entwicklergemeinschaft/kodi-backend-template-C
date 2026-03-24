const vitualTownhallService = require("../services/virtualTownhall");

const getVirtualTownhall = async function (req, res, next) {
    try {
        const userId = req.userId;
        const { translate } = req.query;
        const data = await vitualTownhallService.getVirtualTownhall(
            userId,
            translate
        );
        res.status(200).json({
            status: "success",
            data
        });
    } catch (err) {
        return next(err);
    }
};

const getMunicipalities = async function (req, res, next) {
    try {
        const { cityId } = req.query;
        if (!cityId) {
            return res.status(400).json({
                status: "fail",
                message: "cityId is required"
            });
        }
        const data = await vitualTownhallService.getMunicipalities(cityId);
        res.status(200).json({
            status: "success",
            data
        });
    } catch (err) {
        return next(err);
    }
};

const getMunicipalityById = async function (req, res, next) {
    try {
        const { municipalityId } = req.query;
        if (!municipalityId) {
            return res.status(400).json({
                status: "fail",
                message: "municipalityId is required"
            });
        }
        const data = await vitualTownhallService.getMunicipalityById(
            municipalityId
        );
        res.status(200).json({
            status: "success",
            data
        });
    } catch (err) {
        return next(err);
    }
};

const getPlacesInMunicipalities = async function (req, res, next) {
    try {
        const { municipalityId } = req.query;
        if (!municipalityId) {
            return res.status(400).json({
                status: "fail",
                message: "municipalityId is required"
            });
        }
        const data = await vitualTownhallService.getPlacesInMunicipalities(
            municipalityId
        );
        res.status(200).json({
            status: "success",
            data
        });
    } catch (err) {
        return next(err);
    }
};

module.exports = {
    getVirtualTownhall,
    getMunicipalities,
    getMunicipalityById,
    getPlacesInMunicipalities
};
