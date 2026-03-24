const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");
class LevelsRepo extends BaseRepo {
    constructor() {
        super(tableNames.LEVELS_TABLE);
    }
}

module.exports = new LevelsRepo();