const express = require("express");
const router = express.Router();
const authentication = require("../middlewares/authentication");
const {
    fitStats,
    userEquipmentStats,
    exerciseDetails,
    markFavourite,
    tracker,
    userTrophies,
    offlineFitStats,
    bulkTrackers,
    gamingList,
    gameDetails,
    gameSteps,
    gamesTracker,
    favoritesEquipments
} = require("../controllers/digifit");

router.get("/", authentication, fitStats);
router.get(
    "/user-equipment-stats/:locationId",
    authentication,
    userEquipmentStats
);
router.get(
    "/exercise-details",
    authentication,
    exerciseDetails
);
router.post("/toggle-favorite", authentication, markFavourite);
router.post("/tracker", authentication, tracker);
router.get("/user-trophies", authentication, userTrophies);

router.get("/offline-fit-stats", authentication, offlineFitStats);
router.post("/bulk-trackers", authentication, bulkTrackers);

// Gaming Routes
router.get("/games-list", authentication, gamingList);
router.get("/game/:id", authentication, gameDetails);
router.get("/game-steps/:gameId/:levelId", authentication, gameSteps);
router.post("/games-tracker", authentication, gamesTracker);
router.get('/favoriteEquipments', authentication, favoritesEquipments)
module.exports = router;
