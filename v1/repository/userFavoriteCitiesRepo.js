const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");
const database = require("../utils/database");

class FavoritesRepo extends BaseRepo {
    constructor() {
        super(tableNames.USER_FAVORITE_CITIES_TABLE);
    }

    /**
     * Retrieve favorite cities for a user by joining favorites with cities,
     * ordered by favorites.createdAt with pagination.
     */
    retrieveFavoriteCitiesWithJoin = async ({
        userId,
        cityId,
        pageNo = 1,
        pageSize = 10,
        isDescending = false,
    }) => {
        const queryParams = [];
        let query = `
            SELECT c.*,
                   TRUE AS isFavorite
            FROM user_favorite_cities ufc
            INNER JOIN cities c ON c.id = ufc.cityId
            WHERE ufc.userId = ?
        `;
        queryParams.push(userId);

        if (cityId && !isNaN(Number(cityId))) {
            query += ` AND ufc.cityId = ? `;
            queryParams.push(Number(cityId));
        }

        query += ` ORDER BY ufc.createdAt ${isDescending ? 'DESC' : 'ASC'} `;
        const offset = (Number(pageNo) - 1) * Number(pageSize);
        query += ` LIMIT ?, ? `;
        queryParams.push(parseInt(offset, 10), parseInt(pageSize, 10));

        const response = await database.callQuery(query, queryParams);
        return response.rows || [];
    }
}

module.exports = new FavoritesRepo();
