const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");
class UserTrophiesRepo extends BaseRepo {
    constructor() {
        super(tableNames.USER_TROPHIES_TABLE);
    }
}

module.exports = new UserTrophiesRepo();