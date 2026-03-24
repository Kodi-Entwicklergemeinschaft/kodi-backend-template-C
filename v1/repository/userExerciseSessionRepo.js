const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");
class EquipmentRepo extends BaseRepo {
    constructor() {
        super(tableNames.USER_EXERCISE_SESSIONS_TABLE);
    }
}

module.exports = new EquipmentRepo();