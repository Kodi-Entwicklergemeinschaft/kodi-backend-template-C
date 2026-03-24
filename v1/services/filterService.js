const AppError = require("../utils/appError");
const categoriesRepo = require("../repository/categoriesRepo");
const cityServiceRepository = require("../repository/citiesRepo");
const supportedLanguages = require("../constants/supportedLanguages");
const { translateObjectValues } = require("./translationService");

const filterList = async function (translate) {
    try {
        const Period = {
            name: "Zeitraum",
            data: [
                { name: "today", value: "today"},
                { name: "week", value: "week"},
                { name: "next7days", value: "next7days"},
                { name: "next30days", value: "next30days"}
            ],
        };

        const categories = { name: "Kategorie",  data: [] };
        const cities = { name: "Ort / Entfernung", data: [] };

        const [categoriesResp, citiesRes] = await Promise.all([
            categoriesRepo.getAll({
                filters: [{ key: "isEnabled", sign: "=", value: true }],
                columns: "id, name",
            }),
            cityServiceRepository.getAll({
                filters: [{ key: "type", sign: "=", value: "city"}],
                columns: "id, name",
                orderBy: ["name"],
            }),
        ]);
        
        categories.data = categoriesResp?.rows || [];
        categories.data.push({ id: 100, name: "Favorites" });
        cities.data = citiesRes?.rows || [];

        let data = { Period, categories, cities };

        if (translate && supportedLanguages.includes(translate)) {
            data = await translateObjectValues({ ...data }, translate, ["name",]);
        }

        return data;
    } catch (err) {
        throw err instanceof AppError ? err : new AppError(err);
    }
};

module.exports = {
    filterList
};