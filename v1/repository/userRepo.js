const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");
const database = require("../utils/database");
const storedProcedures = require("../constants/storedProcedures");
class UserRepo extends BaseRepo {
    constructor() {
        super(tableNames.USER_TABLE);
    }

    // implement transaction
    deleteCityUserProcedure = async (userId, cityId) => {
        await database.callStoredProcedure(
            storedProcedures.DELETE_CITY_USER,
            [userId],
            cityId,
        );
    }

    deleteCoreUserProcedure = async (userId) => {
        await database.callStoredProcedure(storedProcedures.DELETE_CORE_USER, [
            userId,
        ]);
    }

    getUsersForNotification = async (cityId, categoryId) => {
        const query = `SELECT DISTINCT u.id AS userId FROM users u
            JOIN user_preference_cities upc ON u.id = upc.userId
            JOIN user_preference_categories upcat ON u.id = upcat.userId
            WHERE upc.cityId IN (?) AND upcat.categoryId = ?;
        `;
        const response = await database.callQuery(query, [cityId, categoryId]);
        return response.rows;
    }

    getUsersForNotificationWithUserFilter = async (cityId, categoryId, userIds) => {
        const query = `SELECT DISTINCT u.id AS userId FROM users u
            JOIN user_preference_cities upc ON u.id = upc.userId
            JOIN user_preference_categories upcat ON u.id = upcat.userId
            WHERE upc.cityId IN (?) 
            AND upcat.categoryId = ? 
            AND u.id IN (?);`;
        const response = await database.callQuery(query, [cityId, categoryId, userIds]);
        return response.rows;
    }

    getUsersByOnboardingCity = async (cityIds) => {
        const query = `SELECT DISTINCT id AS userId FROM users
            WHERE (cityId IN (?) OR cityId IS NULL) AND allNotificationsEnabled = 1;`;
        const response = await database.callQuery(query, [cityIds]);
        return response.rows;
    }

    getUsersByOnboardingCityOnly = async (cityIds) => {
        const query = `SELECT DISTINCT id AS userId FROM users
            WHERE cityId IN (?) AND allNotificationsEnabled = 1;`;
        const response = await database.callQuery(query, [cityIds]);
        return response.rows;
    }

    getUserWithInterests = async (userId) => {
        let query = `SELECT 
    u.id, 
    u.username, 
    u.socialMedia, 
    u.email, 
    u.website, 
    u.description, 
    u.image, 
    u.phoneNumber, 
    u.firstname, 
    u.lastname, 
    u.roleId,
    IF(u.allNotificationsEnabled = 1, true, false) AS allNotificationsEnabled,
    c.name AS cityName,
    CASE 
        WHEN COUNT(i.id) = 0 THEN JSON_ARRAY()
        ELSE JSON_ARRAYAGG(
            JSON_OBJECT(
                'interestId', i.id,
                'interestName', i.name
            )
        )
    END AS preferences
    FROM heidi_core.users u
    LEFT JOIN heidi_core.cities c 
    ON u.cityId = c.id
    LEFT JOIN heidi_core.user_preference_interests upi 
    ON u.id = upi.userId
    LEFT JOIN heidi_core.interests i 
    ON upi.interestId = i.id `;

        if (userId) {
            query += `WHERE u.id IN (?) `;
        }

        query += `GROUP BY u.id;`

        return await database.callQuery(query, [userId]);
    }

}

module.exports = new UserRepo();