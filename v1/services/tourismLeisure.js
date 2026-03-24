const AppError = require("../utils/appError");
const DiscoverServicesRepository = require("../repository/discoverServicesRepo");
const DiscoverServiceEntriesRepository = require("../repository/discoverServiceEntriesRepo");
const supportedLanguages = require("../constants/supportedLanguages");
const { translateObjectValues } = require("./translationService");

const getTourismLeisure = async function (translate) {
    try {
        const tourismLeisure = await DiscoverServicesRepository.getOne({
            filters: [
                {
                    key: "route",
                    sign: "=",
                    value: "/tourismLeisure"
                }
            ]
        });
        const tourismLeisureId = tourismLeisure.id;
        const tourismLeisureServices =
            await DiscoverServiceEntriesRepository.getAll({
                filters: [
                    {
                        key: "discoverServiceId",
                        sign: "=",
                        value: tourismLeisureId
                    },
                    {
                        key: "isActive",
                        sign: "=",
                        value: true
                    }
                ]
            });

        const servicesOffered = tourismLeisureServices.rows.filter(
            (service) => {
                return service.type === "service";
            }
        );

        tourismLeisure.servicesOffered = servicesOffered;

        const moreInformations = tourismLeisureServices.rows.filter(
            (service) => {
                return service.type === "info";
            }
        );
        tourismLeisure.moreInformations = moreInformations;

        const contactDetails = tourismLeisureServices.rows.filter((service) => {
            return service.type === "contact";
        });
        tourismLeisure.contactDetails = contactDetails;

        const links = tourismLeisureServices.rows.filter((service) => {
            return service.type === "link";
        });
        tourismLeisure.links = links;

        if (translate && supportedLanguages.includes(translate)) {
            await translateObjectValues(tourismLeisure, translate, ["title","description"]);
        }

        return tourismLeisure;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

module.exports = {
    getTourismLeisure
};
