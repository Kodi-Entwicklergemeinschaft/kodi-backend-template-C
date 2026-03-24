const AppError = require("../utils/appError");
const DiscoverServicesRepository = require("../repository/discoverServicesRepo");
const cityServiceRepository = require("../repository/citiesRepo");

const getMeinOrt = async function (userId = null) {
    try {
        const meinOrt = await DiscoverServicesRepository.getOne({
            filters: [
                {
                    key: "route",
                    sign: "=",
                    value: "/meinOrt"
                }
            ]
        });

        const municipalities = await cityServiceRepository.getMeinOrt(userId);
        if (meinOrt) {
            meinOrt.municipalities = municipalities;
        }
        // TODO: Reverting till client review
        // return meinOrt;
        return municipalities;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

module.exports = {
    getMeinOrt
};
