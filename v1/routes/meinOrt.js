const express = require("express");
const router = express.Router();
const { getMeinOrt } = require("../controllers/meinOrt");
const optionalAuthentication = require("../middlewares/optionalAuthentication");

router.get("/", optionalAuthentication, getMeinOrt);

module.exports = router;
