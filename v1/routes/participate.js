const express = require("express");
const router = express.Router();
const { getParticipate } = require("../controllers/participate");

router.get("/", getParticipate);

module.exports = router;
