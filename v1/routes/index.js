require("dotenv").config();
const express = require("express");

const router = express.Router();
const listingsRouter = require("./listings");
const usersRouter = require("./users");
const favoriteRouter = require("./favorites");
const citiesRouter = require("./cities");
const accessibilityTagsRouter = require("./accessibilityTags");
const villageRouter = require("./village");
const categoriesRouter = require("./categories");
const interestsRouter = require("./interests");
const statusRouter = require("./status");
const citizenServicesRouter = require("./citizenServices");
const virtualTownhallRouter = require("./virtualTownhall");
const meinOrtRouter = require("./meinOrt");
const mobilityRouter = require("./mobility");
const participateRouter = require("./participate");
const tourismLeisureRouter = require("./tourismLeisure");
const contactUsRouter = require("./contactUs");
const moreInfoRouter = require("./moreInfo");
const feedbackRouter = require("./feedbacks");
const advertisement = require("./ads");
const wasteCalender = require("./wasteCalender");
const defectReportRouter = require("./defectReporter");
const digifitRouter = require("./digifit");
const thirdPartyRouter = require("./thirdParty");
const { validateCityId } = require("../middlewares/validators");
const filter = require("./filter");

// Hello World Route
router.get("/", (req, res) => {
    const helloMessage = {
        status: "success",
        message: "Hello world!! Welcome to HEIDI!!"
    };
    res.send(helloMessage);
});

router.use("/users", usersRouter);
router.use("/cities", citiesRouter);
router.use("/accessibilityTags", accessibilityTagsRouter);
router.use("/listings", listingsRouter);
router.use("/categories", categoriesRouter);
router.use("/interests", interestsRouter);
router.use("/status", statusRouter);
router.use("/citizenServices", citizenServicesRouter);
router.use("/virtualTownhall", virtualTownhallRouter);
router.use("/meinOrt", meinOrtRouter);
router.use("/mobility", mobilityRouter);
router.use("/participate", participateRouter);
router.use("/tourismLeisure", tourismLeisureRouter);
router.use("/contactUs", contactUsRouter);
router.use("/moreInfo", moreInfoRouter);
router.use("/feedbacks", feedbackRouter);
router.use("/users/favorites", favoriteRouter);
router.use("/cities/:cityId/villages", validateCityId, villageRouter);
if (process.env.WASTE_CALENDER_ENABLED === "True")
    router.use("/cities/:cityId/wasteCalender", validateCityId, wasteCalender);
router.use("/ads", advertisement);
router.use("/reportDefect", defectReportRouter); // TODO: convert to service-repository pattern
router.use("/digifit", digifitRouter);
router.use("/thirdParty", thirdPartyRouter);
router.use('/filter', filter)
module.exports = router;
