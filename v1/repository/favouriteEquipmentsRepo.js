const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");
const database = require("../utils/database");

class FavoriteEquipmentsRepo extends BaseRepo {
    constructor() {
        super(tableNames.USER_FAVOURITE_EQUIPMENTS_TABLE);
    }

    retrieveFavoriteEquipments = async ({
        userId = null,
        locationIds = [],
        equipmentIds = [],
        pageNo = 1,
        pageSize = 10,
    }) => {
        const queryParams = [];

        let query = `
        SELECT
            e.id as equipmentId,
            e.name,
            e.muscleGroup,
            e.locationId,
            e.machineImageUrls,
            e.description,
            e.recommendedSets,
            e.recommendedReps,
            e.minReps,
            e.minSets,
            e.qrCodeIdentifier,
            l.name as locationName,
            l.mapImageUrl
    `;

        if (userId !== null) {
            query += `,
            TRUE as isFavorite,
            IF(ues.isCompleted = 1, TRUE, FALSE) as isCompleted
        `;
        } else {
            query += `,
            FALSE as isFavorite,
            FALSE as isCompleted
        `;
        }

        query += `
        FROM equipment e
        INNER JOIN user_favourite_equipments ufe
            ON e.id = ufe.equipmentId
    `;

        if (userId !== null) {
            query += ` AND ufe.userId = ? `;
            queryParams.push(userId);
        }

        // Join exercise sessions to derive completion status for this user/equipment
        if (userId !== null) {
            query += `
        LEFT JOIN user_exercise_sessions ues
            ON ues.equipmentId = e.id AND ues.userId = ?
    `;
            queryParams.push(userId);
        }

        query += `
        LEFT JOIN locations l
            ON e.locationId = l.id
        WHERE 1=1
    `;

        if (locationIds.length > 0) {
            query += ` AND e.locationId IN (?) `;
            queryParams.push(locationIds);
        }

        if (equipmentIds.length > 0) {
            query += ` AND e.id IN (?) `;
            queryParams.push(equipmentIds);
        }

        const offset = (pageNo - 1) * pageSize;
        query += ` ORDER BY ufe.createdAt desc, e.id LIMIT ?, ? `;
        queryParams.push(offset, parseInt(pageSize, 10));

        try {
            const response = await database.callQuery(query, queryParams);
            const equipments = response.rows.map((eq) => ({
                ...eq,
                isFavorite: Boolean(eq.isFavorite),
                isCompleted: Boolean(eq.isCompleted)
            }));

            return equipments;
        } catch (error) {
            if (error instanceof Error) throw error;
            throw new Error("Error retrieving favorite equipments");
        }
    };
}

module.exports = new FavoriteEquipmentsRepo();
