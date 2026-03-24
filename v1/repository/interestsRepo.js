const BaseRepo = require('./baseRepo');
const tableNames = require('../constants/tableNames');

class InterestsRepo extends BaseRepo {
    constructor() {
        super(tableNames.INTERESTS_TABLE);
    }
}

module.exports = new InterestsRepo();
