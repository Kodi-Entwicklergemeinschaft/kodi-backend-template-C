const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");
class UserGamePointsRepo extends BaseRepo {
    constructor() {
        super(tableNames.USER_GAME_POINTS);
    }


}

module.exports = new UserGamePointsRepo();