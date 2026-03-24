const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");
class TrophiesRepo extends BaseRepo {
    constructor() {
        super(tableNames.TROPHIES_TABLE);
    }
}

module.exports = new TrophiesRepo();