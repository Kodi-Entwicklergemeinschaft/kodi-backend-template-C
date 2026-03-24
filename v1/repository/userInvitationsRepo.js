const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");
const database = require("../utils/database");

class UserInvitationsRepo extends BaseRepo {
    constructor() {
        super(tableNames.USER_INVITATIONS_TABLE);
    }

    /**
     * Fetch a pending (unused) invitation by email.
     */
    getByEmail = async (email) => {
        const response = await database.callQuery(
            `SELECT id, email, roleId, cityIds, invitedBy, usedAt, createdAt
             FROM user_invitations
             WHERE email = ? AND usedAt IS NULL
             LIMIT 1;`,
            [email]
        );
        if (!response || !response.rows || response.rows.length === 0) return null;
        const row = response.rows[0];
        // Parse JSON cityIds back to array
        if (row.cityIds && typeof row.cityIds === "string") {
            row.cityIds = JSON.parse(row.cityIds);
        }
        return row;
    };

    /**
     * Mark an invitation as used.
     */
    markUsed = async (id) => {
        const now = new Date().toISOString().slice(0, 19).replace("T", " ");
        await database.callQuery(
            `UPDATE user_invitations SET usedAt = ? WHERE id = ?;`,
            [now, id]
        );
    };

    /**
     * Fetch all invitations with registration status.
     * If the user has registered (matched by email), isRegistered = true
     * and roleId is taken from the users table; otherwise from the invitation.
     */
    getAllWithRegistrationStatus = async (cityId = null) => {
        let query = `SELECT
                ui.id,
                ui.email,
                ui.cityIds,
                ui.invitedBy,
                ui.createdAt,
                ui.usedAt,
                CASE WHEN u.id IS NOT NULL THEN 1 ELSE 0 END AS isRegistered,
                COALESCE(u.roleId, ui.roleId)              AS roleId,
                u.id                                        AS userId,
                u.firstname,
                u.lastname
             FROM user_invitations ui
             LEFT JOIN users u ON u.email = ui.email AND u.isDeleted = 0`;
        const params = [];
        if (cityId) {
            query += ` WHERE JSON_CONTAINS(ui.cityIds, CAST(? AS JSON))`;
            params.push(cityId);
        }
        query += ` ORDER BY ui.createdAt DESC;`;
        const response = await database.callQuery(query, params);
        if (!response || !response.rows) return [];
        return response.rows.map((row) => ({
            ...row,
            isRegistered: row.isRegistered === 1,
            cityIds: row.cityIds && typeof row.cityIds === "string"
                ? JSON.parse(row.cityIds)
                : row.cityIds ?? null,
        }));
    };

}

module.exports = new UserInvitationsRepo();
