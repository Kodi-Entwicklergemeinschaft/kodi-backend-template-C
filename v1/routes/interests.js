const express = require("express");
const router = express.Router();
const { getAllInterests } = require("../controllers/interests");

router.get("/", getAllInterests);

module.exports = router;
