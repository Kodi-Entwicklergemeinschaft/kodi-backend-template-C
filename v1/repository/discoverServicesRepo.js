const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");

class DiscoverServicesRepo extends BaseRepo {
    constructor() {
        super(tableNames.DISCOVER_SERVICES_TABLE);
    }
}

module.exports = new DiscoverServicesRepo();
