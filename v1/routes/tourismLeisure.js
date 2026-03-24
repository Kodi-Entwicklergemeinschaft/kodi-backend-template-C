const express = require("express");
const router = express.Router();
const { getTourismLeisure } = require("../controllers/tourismLeisure");

router.get("/", getTourismLeisure);

module.exports = router;
