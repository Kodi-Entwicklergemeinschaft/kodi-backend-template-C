const express = require("express");
const router = express.Router();
const authentication = require("../middlewares/authentication");
const {
    getAllFavoritesForUser,
    getFavoriteListingsForUser,
    addNewFavoriteForUser,
    deleteFavoriteListingForUser,
    getFavoriteCitiesForUser,
    addNewFavoriteCityForUser,
    deleteFavoriteCityForUser,
} = require("../controllers/favorites");

// To get the favorite ID  of a user
router.get("/", authentication, getAllFavoritesForUser);

// To get all the listings from the favorite table
router.get("/listings", authentication, getFavoriteListingsForUser);

// To insert or add  a listing into favorite table
router.post("/", authentication, addNewFavoriteForUser);

// To delete  a favorite listing from favorite table
router.delete("/:listingId", authentication, deleteFavoriteListingForUser);

// To get all the listings from the favorite table
router.get("/cities", authentication, getFavoriteCitiesForUser);

// To insert or add  a city into favorite city table
router.post("/cities", authentication, addNewFavoriteCityForUser);

// To delete  a favorite city from favorite table
router.delete("/cities/:cityId", authentication, deleteFavoriteCityForUser);

module.exports = router;
