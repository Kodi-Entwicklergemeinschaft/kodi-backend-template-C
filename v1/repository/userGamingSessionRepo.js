const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");
class UserGamingSessionRepo extends BaseRepo {
    constructor() {
        super(tableNames.USER_GAMING_SESSIONS_TABLE);
    }
}

module.exports = new UserGamingSessionRepo();