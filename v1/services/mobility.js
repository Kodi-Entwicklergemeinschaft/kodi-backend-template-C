const AppError = require("../utils/appError");
const DiscoverServicesRepository = require("../repository/discoverServicesRepo");
const DiscoverServiceEntriesRepository = require("../repository/discoverServiceEntriesRepo");
const { translateObjectValues } = require("./translationService");
const supportedLanguages = require("../constants/supportedLanguages");

const getMobility = async function (translate) {
    try {
        const mobility = await DiscoverServicesRepository.getOne({
            filters: [
                {
                    key: "route",
                    sign: "=",
                    value: "/mobility"
                }
            ]
        });
        const mobilityId = mobility.id;
        const mobilityServices = await DiscoverServiceEntriesRepository.getAll({
            filters: [
                {
                    key: "discoverServiceId",
                    sign: "=",
                    value: mobilityId
                },
                {
                    key: "isActive",
                    sign: "=",
                    value: true
                }
            ]
        });

        const servicesOffered = mobilityServices.rows.filter((service) => {
            return service.type === "service";
        });

        mobility.servicesOffered = servicesOffered;

        const moreInformations = mobilityServices.rows.filter((service) => {
            return service.type === "info";
        });
        mobility.moreInformations = moreInformations;

        const contactDetails = mobilityServices.rows.filter((service) => {
            return service.type === "contact";
        });
        mobility.contactDetails = contactDetails;

        const links = mobilityServices.rows.filter((service) => {
            return service.type === "link";
        });
        mobility.links = links;

        if (translate && supportedLanguages.includes(translate)) {
            try {
                await translateObjectValues(mobility, translate, ['title', 'description']);
            } catch (error) {
                console.error("Translation error:", error);
            }
        }

        return mobility;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

module.exports = {
    getMobility
};
