const express = require("express");
const router = express.Router();
const { getWeather } = require("../controllers/thirdParty");
const optionalAuthentication = require("../middlewares/optionalAuthentication");

router.get("/weather", optionalAuthentication, getWeather);

module.exports = router;
