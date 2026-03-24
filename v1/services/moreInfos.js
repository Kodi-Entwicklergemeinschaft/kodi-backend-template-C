const moreInfoTranslations = require("../constants/moreInfoTranslations");
const legalContent = require("../constants/legalContent");
// const moreInfoRepo = require("../repository/moreInfo");
const moreInfoRepository = require("../repository/moreInfoRepo");
const AppError = require("../utils/appError");
const { translateObjectValues } = require("./translationService");

const getMoreInfo = async function (queryLanguage) {
    let language = "de";
    if (queryLanguage === "en") {
        language = "en";
    }
    try {
        // const data = await moreInfoRepo.getMoreInfoService();
        const dataResp = await moreInfoRepository.getAll();
        const data = dataResp.rows;
        data.forEach((d) => {
            d.title = moreInfoTranslations[language][d.title];
            d.isPdf = d.isPdf === 1;
        });
        return data;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const getLegalContent = async (type, translate = 'de') => {
    try {
        const validTypes = ['terms-and-conditions', 'privacy-policy', 'imprint-page'];
        
        if (!validTypes.includes(type)) {
            throw new AppError('Invalid content type requested', 400);
        }
        
        const content = legalContent[type];
        const response = {
            type,
            content
        };
        return translate ? await translateObjectValues(response, translate, ['content']) : response;
    } catch (err) {
        console.log(err)
        if (err instanceof AppError) throw err;
        throw new AppError('Failed to retrieve legal content', 500);
    }
};

module.exports = {
    getMoreInfo,
    getLegalContent,
};
