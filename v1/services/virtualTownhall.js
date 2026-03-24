const AppError = require("../utils/appError");
const cityServiceRepository = require("../repository/citiesRepo");
const { translateObjectValues } = require("./translationService");
const supportedLanguages = require("../constants/supportedLanguages");

const getVirtualTownhall = async function (userId = null, translate) {
    try {
        const virtualTownhall = await cityServiceRepository.getVirtualTownhall(
            userId
        );

        if (translate && supportedLanguages.includes(translate)) {
            try {
                // Translate the main virtual townhall object
                await translateObjectValues(virtualTownhall, translate, ['name', 'title', 'description', 'subtitle', 'address', 'mayor_name', 'mayor_description']);
                
                // Translate each online service
                if (virtualTownhall.onlineServices && Array.isArray(virtualTownhall.onlineServices)) {
                    await Promise.all(
                        virtualTownhall.onlineServices.map(service => 
                            translateObjectValues(service, translate, ['name', 'title', 'description', 'subtitle', 'address', 'mayor_name', 'mayor_description'])
                        )
                    );
                }
                
                // Set language indicators
                if (virtualTownhall.description) {
                    virtualTownhall.descriptionLanguage = 'auto';
                }
                if (virtualTownhall.subtitle) {
                    virtualTownhall.subtitleLanguage = 'auto';
                }
                if (virtualTownhall.onlineServices) {
                    virtualTownhall.onlineServices.forEach(service => {
                        if (service.title) service.titleLanguage = 'auto';
                        if (service.description) service.descriptionLanguage = 'auto';
                    });
                }
            } catch (error) {
                console.error("Translation error:", error);
            }
        }

        return virtualTownhall;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const getMunicipalities = async function (cityId) {
    try {
        const municipalities = await cityServiceRepository.getMunicipalities(
            cityId
        );
        // add the online services to the municipalities in paeallel
        const onlineServices = await Promise.all(
            municipalities.map(async (municipality) => {
                const onlineServices =
                    await cityServiceRepository.getCityOnlineServices(
                        municipality.id
                    );
                municipality.onlineServices = onlineServices;
                return municipality;
            })
        );
        // add the online services to the municipalities
        municipalities.forEach((municipality, index) => {
            municipality.onlineServices = onlineServices[index].onlineServices;
        });

        return onlineServices;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const getMunicipalityById = async function (cityId) {
    try {
        const municipalities = await cityServiceRepository.getCityById(cityId);
        return municipalities;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const getPlacesInMunicipalities = async function (cityId) {
    try {
        const municipalities =
            await cityServiceRepository.getPlacesInMunicipalities(cityId);
        return municipalities;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

module.exports = {
    getVirtualTownhall,
    getMunicipalities,
    getMunicipalityById,
    getPlacesInMunicipalities
};
