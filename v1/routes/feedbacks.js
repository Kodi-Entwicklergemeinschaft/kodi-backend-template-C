const express = require("express");
const router = express.Router();
const authentication = require("../middlewares/authentication");
const { getAllFeedbacks, submitFeedback } = require("../controllers/feedbacks");

// To get the favorite ID  of a user
router.get("/", authentication, getAllFeedbacks);

// To insert or add  a listing into favorite table
router.post("/", submitFeedback);

module.exports = router;
