const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");
class UserExerciseSetsRepo extends BaseRepo {
    constructor() {
        super(tableNames.USER_EXERCISE_SETS_TABLE);
    }
}

module.exports = new UserExerciseSetsRepo();