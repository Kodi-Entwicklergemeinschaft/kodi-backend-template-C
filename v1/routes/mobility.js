const express = require("express");
const router = express.Router();
const { getMobility } = require("../controllers/mobility");

router.get("/", getMobility);

module.exports = router;
