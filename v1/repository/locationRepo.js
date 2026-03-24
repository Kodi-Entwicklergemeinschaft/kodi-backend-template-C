const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");

class LocationRepo extends BaseRepo {
    constructor() {
        super(tableNames.LOCATIONS_TABLE);
    }
}

module.exports = new LocationRepo();
