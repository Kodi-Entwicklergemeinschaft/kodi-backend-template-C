const express = require("express");
const router = express.Router();
const { getAllAccessibilityTags } = require("../controllers/accessibilityTags");

router.get("/", getAllAccessibilityTags);

module.exports = router;
