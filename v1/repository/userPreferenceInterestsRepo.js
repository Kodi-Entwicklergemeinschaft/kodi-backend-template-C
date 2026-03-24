const BaseRepo = require('./baseRepo');
const tableNames = require('../constants/tableNames');
const database = require("../utils/database");

class UserPreferenceInterestsRepo extends BaseRepo {
    constructor() {
        super(tableNames.USER_PREFERENCE_INTERESTS_TABLE);
    }

    getInterestsByUserId = async (userId) => {
        const query = `
        SELECT 
            i.id, 
            i.name
        FROM interests i
        INNER JOIN user_preference_interests upi ON i.id = upi.interestId
        WHERE upi.userId = ?;
    `;
        const queryParams = [userId];
        try {
            const response = await database.callQuery(
                query,
                queryParams
            );
            const interests = response?.rows
        
            return interests;
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error("Error retrieving listings");
        }
        
    };
}

module.exports = new UserPreferenceInterestsRepo();
