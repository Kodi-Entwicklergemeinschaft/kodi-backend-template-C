const express = require("express");
const router = express.Router();
const {
    getVirtualTownhall,
    getMunicipalities,
    getMunicipalityById,
    getPlacesInMunicipalities
} = require("../controllers/virtualTownhall");
const optionalAuthentication = require("../middlewares/optionalAuthentication");

router.get("/",optionalAuthentication, getVirtualTownhall);

router.get("/getMunicipalities", getMunicipalities);

router.get("/getMunicipalityById", getMunicipalityById);

router.get("/getPlacesInMunicipalities", getPlacesInMunicipalities);

module.exports = router;
