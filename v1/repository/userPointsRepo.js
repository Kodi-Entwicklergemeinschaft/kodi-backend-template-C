const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");
class UserPointsRepo extends BaseRepo {
    constructor() {
        super(tableNames.USER_POINTS_TABLE);
    }


}

module.exports = new UserPointsRepo();