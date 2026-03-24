const express = require("express");
const router = express.Router();
const { filterList } = require("../controllers/filter");

router.get("/filter-list", filterList);

module.exports = router;