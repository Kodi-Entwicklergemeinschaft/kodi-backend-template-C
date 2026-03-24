const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");

class CitiesRepo extends BaseRepo {
    constructor() {
        super(tableNames.ONLINE_SERVICES_TABLE);
    }
}

module.exports = new CitiesRepo();
