const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");
class StampsRepo extends BaseRepo {
    constructor() {
        super(tableNames.STAMPS_TABLE);
    }
}

module.exports = new StampsRepo();