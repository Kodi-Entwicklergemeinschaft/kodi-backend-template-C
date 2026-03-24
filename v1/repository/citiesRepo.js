const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");
const database = require("../utils/database");
const { getOpeningHours } = require("../constants/municipalityOfiiceHours");

class CitiesRepo extends BaseRepo {
    constructor() {
        super(tableNames.CITIES_TABLE);
    }

    getUserCityMapping = async (userId) => {
        const mappings = await database.callQuery(
            "SELECT cityId, userId, cityUserId, inCityServer FROM cities c INNER JOIN user_cityuser_mapping m ON c.id = m.cityId WHERE userId = ?;",
            [userId]
        );
        return mappings.rows;
    };

    getCityOnlineServices = async (cityId) => {
        const onlineServices = await database.callQuery(
            `SELECT id, title, description, linkUrl, iconUrl,
                displayOrder, isActive
            FROM online_services
            WHERE cityId = ? AND isActive = 1
            ORDER BY displayOrder;`,
            [cityId]
        );
        return onlineServices.rows;
    };

    getTopFiveCities = async (cityId, userId) => {
        const topFiveCities = await database.callQuery(
            `SELECT id, name, type, image, mapImage, subtitle, websiteUrl, parentId
            FROM cities WHERE parentId = ? AND isActive = 1 LIMIT 5;`,
            [cityId]
        );
        // add isFavorite to each city
        await Promise.all(
            topFiveCities.rows.map(async (city) => {
                city.isFavorite = false;
                if (userId !== null) {
                    const userFavoriteCities = await database.callQuery(
                        `SELECT * FROM user_favorite_cities WHERE userId = ? AND cityId = ?;`,
                        [userId, city.id]
                    );
                    if (userFavoriteCities.rows.length > 0)
                        city.isFavorite = true;
                }
            })
        );
        return topFiveCities.rows;
    };

    getCityById = async (cityId, userId = null) => {
        try {
            const cities = await database.callQuery(
                `SELECT * FROM cities WHERE id = ?;`,
                [cityId]
            );
            if (cities.rows.length === 0) {
                throw new Error("City not found");
            }
            if (cities.rows.length > 1) {
                throw new Error("Multiple cities found");
            }

            const city = cities.rows[0];
            if (city.type === "municipality") {
                city.openUntil = await getOpeningHours(city.id, new Date().getDay());
            }
            city.isFavorite = false;

            if (userId !== null) {
                const userFavoriteCites = await database.callQuery(
                    `SELECT * FROM user_favorite_cities WHERE userId = ? AND cityId = ?;`,
                    [userId, cityId]
                );
                if (userFavoriteCites.rows.length > 0) city.isFavorite = true;
            }

            // add city online services
            const onlineServices = await this.getCityOnlineServices(cityId);
            city.onlineServices = onlineServices;

            if (city.type === "municipality") {
                const topFiveCities = await this.getTopFiveCities(
                    cityId,
                    userId
                );
                city.topFiveCities = topFiveCities;
            }

            // add city municipalities by checking if the city is a district admin
            if (city.type === "district_admin") {
                const municipalities = await this.getMunicipalities(
                    cityId,
                    userId
                );
                city.municipalities = municipalities;
            }

            return city;
        } catch (error) {
            console.error("Error fetching city by ID:", error);
            throw new Error("Error fetching city by ID");
        }
    };

    getMunicipalities = async (parentId, userId = null) => {
        try {
            const municipalities = await database.callQuery(
                `SELECT  id, name, type, image, mapImage, websiteUrl, parentId FROM cities
                WHERE parentId = ? AND isActive = 1 AND type = 'municipality';`,
                [parentId]
            );

            // top five cities of the municipality
            await Promise.all(
                municipalities.rows.map(async (municipality) => {
                    municipality.isFavorite = false;
                    if (userId !== null) {
                        const userFavoriteMunicipalities =
                            await database.callQuery(
                                `SELECT * FROM user_favorite_cities WHERE userId = ? AND cityId = ?;`,
                                [userId, municipality.id]
                            );
                        if (userFavoriteMunicipalities.rows.length > 0)
                            municipality.isFavorite = true;
                    }
                    const topFiveCities = await this.getTopFiveCities(
                        municipality.id,
                        userId
                    );
                    municipality.topFiveCities = topFiveCities;
                    return municipality;
                })
            );

            return municipalities.rows;
        } catch (error) {
            console.error("Error fetching municipalities:", error);
            throw new Error("Error fetching municipalities");
        }
    };

    getAllChildCityIds = async (parentIds) => {
        const allIds = new Set();
        let currentParents = [...parentIds];
        for (let depth = 0; depth < 3 && currentParents.length > 0; depth++) {
            const children = await database.callQuery(
                'SELECT id FROM cities WHERE parentId IN (?) AND isActive = 1',
                [currentParents]
            );
            const childIds = children.rows.map(r => r.id);
            childIds.forEach(id => allIds.add(id));
            currentParents = childIds;
        }
        return [...allIds];
    };

    getPlacesInMunicipalities = async (parentId) => {
        const places = await database.callQuery(
            `SELECT * FROM cities
            WHERE parentId = ? AND isActive = 1 AND type = 'city';`,
            [parentId]
        );
        return places.rows;
    };

    getVirtualTownhall = async (userId = null) => {
        const virtualTownhalls = await database.callQuery(
            `SELECT * FROM cities WHERE type = 'district_admin' AND isActive = 1;`
        );
        if (virtualTownhalls.rows.length === 0) {
            throw new Error("No virtual townhall found");
        }
        if (virtualTownhalls.rows.length > 1) {
            throw new Error("Multiple virtual townhalls found");
        }
        const virtualTownhall = virtualTownhalls.rows[0];
        const cityId = virtualTownhall.id;

        // add city online services
        const onlineServices = await this.getCityOnlineServices(cityId);
        virtualTownhall.onlineServices = onlineServices;

        const municipalities = await this.getMunicipalities(cityId, userId);
        virtualTownhall.municipalities = municipalities;

        return virtualTownhall;
    };

    getMeinOrt = async (userId = null) => {
        const meinOrts = await database.callQuery(
            `SELECT id FROM cities WHERE type = 'district_admin' AND isActive = 1;`
        );
        if (meinOrts.rows.length === 0) {
            throw new Error("No virtual townhall found");
        }
        if (meinOrts.rows.length > 1) {
            throw new Error("Multiple virtual townhalls found");
        }
        const meinOrt = meinOrts.rows[0];
        const cityId = meinOrt.id;

        const municipalities = await this.getMunicipalities(cityId, userId);

        return municipalities;
    };
}

module.exports = new CitiesRepo();
