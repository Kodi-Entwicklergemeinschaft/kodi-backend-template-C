const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");

class AccessibilityTagsRepo extends BaseRepo {
    constructor() {
        super(tableNames.ACCESSIBILITY_TAGS_TABLE);
    }
}

module.exports = new AccessibilityTagsRepo();
