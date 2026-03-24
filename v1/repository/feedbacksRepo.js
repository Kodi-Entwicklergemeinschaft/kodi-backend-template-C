const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");

class FeedbacksRepo extends BaseRepo {
    constructor() {
        super(tableNames.FEEDBACKS_TABLE);
    }
}

module.exports = new FeedbacksRepo();
