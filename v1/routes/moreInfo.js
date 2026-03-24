const express = require("express");
const router = express.Router();
const { getMoreInfo, getLegalContent } = require("../controllers/moreInfos");

router.get("/", getMoreInfo);
router.get("/legal/:type", getLegalContent);

module.exports = router;
