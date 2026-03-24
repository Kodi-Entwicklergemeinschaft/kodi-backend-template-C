const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");

class DiscoverServiceEntriesRepo extends BaseRepo {
    constructor() {
        super(tableNames.DISCOVER_SERVICE_ENTRIES_TABLE);
    }
}

module.exports = new DiscoverServiceEntriesRepo();
