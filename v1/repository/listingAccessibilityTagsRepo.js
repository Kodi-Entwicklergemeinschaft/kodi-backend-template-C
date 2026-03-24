const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");

class ListingAccessibilityTagsRepo extends BaseRepo {
    constructor() {
        super(tableNames.LISTINGS_ACCESSIBILITY_TAGS_TABLE);
    }
}

module.exports = new ListingAccessibilityTagsRepo();
