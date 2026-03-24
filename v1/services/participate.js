const AppError = require("../utils/appError");
const DiscoverServicesRepository = require("../repository/discoverServicesRepo");
const DiscoverServiceEntriesRepository = require("../repository/discoverServiceEntriesRepo");
const { translateObjectValues } = require("./translationService");
const supportedLanguages = require("../constants/supportedLanguages");

const getParticipate = async function (translate) {
    try {
        const participate = await DiscoverServicesRepository.getOne({
            filters: [
                {
                    key: "route",
                    sign: "=",
                    value: "/participate"
                }
            ]
        });
        const participateId = participate.id;
        const participateServices =
            await DiscoverServiceEntriesRepository.getAll({
                filters: [
                    {
                        key: "discoverServiceId",
                        sign: "=",
                        value: participateId
                    },
                    {
                        key: "isActive",
                        sign: "=",
                        value: true
                    }
                ]
            });

        if (translate && supportedLanguages.includes(translate)) {
            try {
                // Translate the main participate object
                await translateObjectValues(participate, translate, ['title', 'description']);
                
                // Translate all services in parallel
                if (participateServices.rows && participateServices.rows.length > 0) {
                    await Promise.all(
                        participateServices.rows.map(service => 
                            translateObjectValues(service, translate, ['title', 'description'])
                        )
                    );
                }
                
                // Set language indicators
                if (participate.title) participate.titleLanguage = 'auto';
                if (participate.description) participate.descriptionLanguage = 'auto';
                
                // Set language indicators for services
                participateServices.rows.forEach(service => {
                    if (service.title) service.titleLanguage = 'auto';
                    if (service.description) service.descriptionLanguage = 'auto';
                });
            } catch (error) {
                console.error("Translation error:", error);
            }
        }

        const servicesOffered = participateServices.rows.filter((service) => {
            return service.type === "service";
        });

        participate.servicesOffered = servicesOffered;

        const moreInformations = participateServices.rows.filter((service) => {
            return service.type === "info";
        });
        participate.moreInformations = moreInformations;

        const contactDetails = participateServices.rows.filter((service) => {
            return service.type === "contact";
        });
        participate.contactDetails = contactDetails;

        const links = participateServices.rows.filter((service) => {
            return service.type === "link";
        });
        participate.links = links;

        return participate;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

module.exports = {
    getParticipate
};
