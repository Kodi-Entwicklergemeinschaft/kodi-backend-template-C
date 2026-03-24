const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");
class GamesRepo extends BaseRepo {
    constructor() {
        super(tableNames.GAMES_TABLE);
    }
}

module.exports = new GamesRepo();