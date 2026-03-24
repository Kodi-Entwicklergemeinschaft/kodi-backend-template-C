const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");
class UserActivityLogRepo extends BaseRepo {
    constructor() {
        super(tableNames.USER_ACTIVITY_LOG_TABLE);
    }
}

module.exports = new UserActivityLogRepo();