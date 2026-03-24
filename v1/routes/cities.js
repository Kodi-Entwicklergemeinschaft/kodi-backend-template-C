const express = require("express");
const router = express.Router();
const { getCities, getCity, updateCity, assignCityAdmin, removeCityAdmin, getCityAdmins, getAdminCities } = require("../controllers/cities");
const rateLimit = require("express-rate-limit");
const optionalAuthentication = require("../middlewares/optionalAuthentication");
const authentication = require("../middlewares/authentication");

const rateLogger = rateLimit({
    windowMs: 5 * 1000, // 5 seconds
    max: 1, // Max 1 request per 5 seconds
    handler: (req, res, next, options) => {
        console.log(`Repeated request detected from ${req.ip}.`);
        req.repeatedRequest = true;
        next(); // Proceed to the next middleware
    },
    standardHeaders: false, // Disable the RateLimit-* headers
    legacyHeaders: false, // Disable the X-RateLimit-* headers
    skipSuccessfulRequests: false // Skip counting successful requests
});

router.get("/", optionalAuthentication, getCities);

// GET /cities/admin-cities — get cities the authenticated user has admin rights for
router.get("/admin-cities", authentication, getAdminCities);

router.get("/:id", rateLogger, optionalAuthentication, getCity);

router.patch("/:id", authentication, updateCity);

// GET /cities/:id/admin — get all admins of a city
router.get("/:id/admin", authentication, getCityAdmins);

// POST /cities/:id/admin  — assign a city admin to a city (Super Admin only)
router.post("/:id/admin", authentication, assignCityAdmin);

// DELETE /cities/:id/admin?userId=<userId>  — remove a city admin (Super Admin only)
router.delete("/:id/admin", authentication, removeCityAdmin);



module.exports = router;
