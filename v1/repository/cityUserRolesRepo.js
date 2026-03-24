const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");
const database = require("../utils/database");

class CityUserRolesRepo extends BaseRepo {
    constructor() {
        super(tableNames.CITY_USER_ROLES_TABLE);
    }

    /**
     * Fetch an existing city-user-roles mapping by cityId and userId.
     */
    getByCityAndUser = async (cityId, userId) => {
        const response = await database.callQuery(
            `SELECT cityId, userId, isAdmin FROM city_user_roles WHERE cityId = ? AND userId = ?;`,
            [cityId, userId]
        );
        if (!response || !response.rows || response.rows.length === 0) {
            return null;
        }
        return response.rows[0];
    };

    /**
     * Fetch all city admin users for a given cityId (with user details).
     */
    getByCityWithUserDetails = async (cityId) => {
        const response = await database.callQuery(
            `SELECT u.id, u.firstname, u.lastname, u.username, u.email, u.image, u.phoneNumber, cur.isAdmin
             FROM city_user_roles cur
             INNER JOIN users u ON cur.userId = u.id
             WHERE cur.cityId = ? AND cur.isAdmin = 1;`,
            [cityId]
        );
        if (!response || !response.rows) return [];
        return response.rows;
    };

    /**
     * Fetch all city admin mappings for a given userId.
     */
    getByUser = async (userId) => {
        const response = await database.callQuery(
            `SELECT cityId, userId, isAdmin FROM city_user_roles WHERE userId = ?;`,
            [userId]
        );
        if (!response || !response.rows) return [];
        return response.rows;
    };

    /**
     * Fetch full city details for all cities a user is admin of.
     */
    getCitiesWithDetailsByUserId = async (userId) => {
        const response = await database.callQuery(
            `SELECT c.id, c.name, c.type, c.image, c.websiteUrl, c.parentId
             FROM city_user_roles cur
             INNER JOIN cities c ON cur.cityId = c.id
             WHERE cur.userId = ? AND cur.isAdmin = 1;`,
            [userId]
        );
        if (!response || !response.rows) return [];
        return response.rows;
    };

    /**
     * Insert a new record into city_user_roles.
     */
    assignAdmin = async (cityId, userId, isAdmin = 1) => {
        const response = await database.callQuery(
            `INSERT INTO city_user_roles (cityId, userId, isAdmin) VALUES (?, ?, ?);`,
            [cityId, userId, isAdmin]
        );
        return response;
    };

    /**
     * Delete a city-user-roles record by cityId and userId.
     */
    deleteAdmin = async (cityId, userId) => {
        const response = await database.callQuery(
            `DELETE FROM city_user_roles WHERE cityId = ? AND userId = ?;`,
            [cityId, userId]
        );
        return response;
    };

}

module.exports = new CityUserRolesRepo();
