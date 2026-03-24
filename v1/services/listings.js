const supportedLanguages = require("../constants/supportedLanguages");
const AppError = require("../utils/appError");
const { translateObjectValues } = require("./translationService");
const listingImagesRepository = require("../repository/listingsImagesRepo");
const pollRepository = require("../repository/pollOptionsRepo");
const listingRepository = require("../repository/listingsRepo");
const favoritesRepository = require("../repository/favoritesRepo");
const cityRepository = require("../repository/citiesRepo");
const statusRepository = require("../repository/statusRepo");
const categoriesRepository = require("../repository/categoriesRepo");
const subcategoriesRepository = require("../repository/subcategoriesRepo");
const cityListingMappingRepo = require("../repository/cityListingMappingRepo");
const listingFunctions = require("../services/listingFunctions");
const status = require("../constants/status");
const source = require("../constants/source");
const imageUpload = require("../utils/imageUpload");
const getPdfImage = require("../utils/getPdfImage");
const pdfUpload = require("../utils/pdfUpload");
const imageDeleteAsync = require("../utils/imageDeleteAsync");
const axios = require("axios");
const parser = require("xml-js");
const roles = require("../constants/roles");
const categories = require("../constants/categories");
const defaultImageCount = require("../constants/defaultImagesInBucketCount");
const DEFAULTIMAGE = "Defaultimage";
const bucketClient = require("../utils/bucketClient");
const isValidDate = require("../utils/validateDate");
const accessibilityTagsRepo = require("../repository/accessibilityTagsRepo");
const listingAccessibilityTagsRepo = require("../repository/listingAccessibilityTagsRepo");
const cityUserRolesRepository = require("../repository/cityUserRolesRepo");

const CATEGORY_SORTING = {
    1: { sortByStartDate: true, todayFirstThenAsc: false, endBeforeDate: 'today' }, // News
    3: { sortByStartDate: true, todayFirstThenAsc: true, startAfterDate: 'today' }, // Events
    41: { sortByStartDate: true, todayFirstThenAsc: true, startAfterDate: 'today' }, // Highlights
    13: { sortByStartDate: true, todayFirstThenAsc: true, endAfterDate: 'today' }, // gastro
};

/**
 * Returns true if userId is a CityAdmin for at least one city that listing (listingId) belongs to.
 */
async function isCityAdminForListing(userId, listingId) {
    const [adminMappings, listingMappings] = await Promise.all([
        cityUserRolesRepository.getByUser(userId),
        cityListingMappingRepo.getAll({
            filters: [{ key: "listingId", sign: "=", value: listingId }]
        })
    ]);
    const adminCityIds = new Set(adminMappings.map((m) => Number(m.cityId)));
    return listingMappings.rows.some((m) => adminCityIds.has(Number(m.cityId)));
}

async function resolveTopLevelCityIds(cityIds) {
    if (!cityIds || cityIds.length === 0) return [];

    const ids = cityIds.map(Number);

    const level0Data = await cityRepository.getAll({
        filters: [{ key: "id", sign: "IN", value: ids }],
        columns: "id,parentId"
    });

    const parentMap = {};
    level0Data.rows.forEach((c) => { parentMap[Number(c.id)] = c.parentId; });

    const parentIds = [...new Set(
        Object.values(parentMap).filter((pid) => pid != null).map(Number)
    )];
    const grandParentMap = {};
    if (parentIds.length > 0) {
        const parentData = await cityRepository.getAll({
            filters: [{ key: "id", sign: "IN", value: parentIds }],
            columns: "id,parentId"
        });
        parentData.rows.forEach((c) => { grandParentMap[Number(c.id)] = c.parentId; });
    }

    const depthOf = (id) => {
        const pid = parentMap[id];
        if (pid == null) return 0;
        const gpid = grandParentMap[Number(pid)];
        if (gpid == null) return 1;
        return 2;
    };

    const depths = ids.map(depthOf);
    const minDepth = Math.min(...depths);
    return ids.filter((_, i) => depths[i] === minDepth);
}

const getAllListings = async ({
    userId,
    pageNo,
    pageSize,
    sortByStartDate,
    statusId,
    subcategoryId,
    categoryId,
    cityId,
    translate,
    showExternalListings,
    isAdmin,
    startAfterDate,
    endBeforeDate,
    endAfterDate,
    dateFilter,
    centerLatitude,
    centerLongitude,
    radius,
    accessibilityTagIds = "",
    skipParentCities
}) => {
    const filters = [];
    let sortByStartDateBool = false;
    let todayFirstThenAsc = false;
    let cities = [];
    let accessibilityTags = [];
    const isFavorite = categoryId && categoryId.includes('100');

    if (isNaN(pageNo) || pageNo <= 0) {
        throw new AppError("Please enter a positive integer for pageNo", 400);
    }

    if (isNaN(pageSize) || pageSize <= 0 || pageSize > 20) {
        throw new AppError(
            "Please enter a positive integer less than or equal to 20 for pageSize",
            400
        );
    }

    if (sortByStartDate) {
        const sortByStartDateString = sortByStartDate.toString();
        if (
            sortByStartDateString !== "true" &&
            sortByStartDateString !== "false"
        ) {
            throw new AppError(
                "The parameter sortByCreatedDate can only be a boolean",
                400
            );
        } else {
            sortByStartDateBool = sortByStartDateString === "true";
        }
    }

    // statusId is handled directly in the subquery inside retrieveListings
    // '*' = admin/cityAdmin sees all; number = specific; Active = default for public
    let effectiveStatusId;
    if (isAdmin) {
        if (statusId) {
            const response = await statusRepository.getOne({
                filters: [
                    {
                        key: "id",
                        sign: "=",
                        value: statusId
                    }
                ]
            });
            if (!response) {
                throw new AppError(`Invalid Status '${statusId}' given`, 400);
            }
            effectiveStatusId = statusId;
        } else {
            effectiveStatusId = '*'; // admin/cityAdmin with no filter sees all statuses
        }
    } else {
        effectiveStatusId = status.Active;
    }

    if (categoryId && !isFavorite) {
        // Validate the categoryId input to ensure it only contains integers separated by commas
        if (!/^\d+(,\d+)*$/.test(categoryId)) {
            throw new AppError(
                `Invalid format for CategoryId '${categoryId}'. Please provide a comma-separated list of integers.`,
                400
            );
        }

        // Parse the categoryId string to an array of integers and remove 100 if present
        let categoryIds = categoryId.split(",").map((id) => parseInt(id.trim(), 10));
        categoryIds = categoryIds.filter(id => id !== 100); // Remove categoryId 100
        const singleCategoryId = categoryIds.length === 1 ? categoryIds[0] : null;

        // If no valid categoryIds remain after filtering, skip category filtering
        if (categoryIds.length > 0) {
            const categoryResp = await categoriesRepository.getAll({
                filters: [
                    {
                        key: "id",
                        sign: "IN",
                        value: categoryIds
                    },
                    {
                        key: "isEnabled",
                        sign: "=",
                        value: true
                    }
                ]
            });

            // Throw an error if no categories are found
            if (!categoryResp.count) {
                throw new AppError(
                    `No categories found for provided CategoryId(s) '${categoryIds.join(', ')}'`,
                    400
                );
            }

            // Add category filter: use '=' for a single categoryId, otherwise 'IN'
            if (singleCategoryId !== null) {
                filters.push({
                    key: "categoryId",
                    sign: "=",
                    value: singleCategoryId
                });
            } else {
                filters.push({
                    key: "categoryId",
                    sign: "IN",
                    value: categoryIds
                });
            }
        }

        if (subcategoryId) {
            const subcategory =
                // await cityListingRepo.getSubCategoryById(subcategoryId);
                await subcategoriesRepository.getAll({
                    filters: [
                        {
                            key: "id",
                            sign: "=",
                            value: subcategoryId
                        }
                    ]
                });
            // if (!subcategory) {
            if (!subcategory || !subcategory.rows || !subcategory.rows.length) {
                throw new AppError(
                    `Invalid subCategory '${subcategoryId}' given`,
                    400
                );
            }
            // filters.subcategoryId = subcategoryId;
            filters.push({
                key: "subcategoryId",
                sign: "=",
                value: subcategoryId
            });
        }

        // Apply category-specific date windows ONLY when no explicit date filters were provided
        const noExplicitDate = !startAfterDate && !endBeforeDate && !endAfterDate && !dateFilter;
        if (noExplicitDate && singleCategoryId !== null) {
            // CHANGED: Use centralized category config
            const catConfig = CATEGORY_SORTING[Number(categoryId)];
            if (catConfig) {
                const today = new Date().toISOString().split("T")[0];
                sortByStartDateBool = catConfig.sortByStartDate;
                todayFirstThenAsc = catConfig.todayFirstThenAsc;
                if (catConfig.startAfterDate) startAfterDate = today;
                if (catConfig.endBeforeDate) endBeforeDate = today;
                if (catConfig.endAfterDate) endAfterDate = today;
            }
        }
    }

    if (dateFilter) {
        const currentDate = new Date();
        switch (dateFilter.toLowerCase()) {
        case "today":
            startAfterDate = currentDate.toISOString().split("T")[0];
            endBeforeDate = startAfterDate;
            break;
        case "week": {
            const startOfWeek = new Date(currentDate);
            startOfWeek.setDate(
                currentDate.getDate() - currentDate.getDay() + 1
            ); // Start of the week (Monday)
            startAfterDate = startOfWeek.toISOString().split("T")[0];
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6); // End of the week (Sunday)
            endBeforeDate = endOfWeek.toISOString().split("T")[0];
            break;
        }
        case "month": {
            const startOfMonth = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                1
            ); // Start of the month
            startAfterDate = startOfMonth.toISOString().split("T")[0];
            const endOfMonth = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth() + 1,
                0
            ); // End of the month
            endBeforeDate = endOfMonth.toISOString().split("T")[0];
            break;
        }
        default:
            throw new AppError(
                "Invalid filterBy value. Allowed values are 'today', 'week', or 'month'.",
                400
            );
        }
    }

    // checks for centerLongitude
    if (centerLongitude) {
        const lon = parseFloat(centerLongitude);
        if (isNaN(lon)) {
            throw new AppError(
                "Invalid longitude value, Longitude value should be a Number",
                400
            );
        }
        if (lon < -180 || lon > 180) {
            throw new AppError(
                "Invalid longitude value, Longitude value should be between -180° to 180°",
                400
            );
        }
    }

    // checks for centerLatitude
    if (centerLatitude) {
        const lat = parseFloat(centerLatitude);
        if (isNaN(lat)) {
            throw new AppError("Invalid latitude value", 400);
        }
        if (lat < -90 || lat > 90) {
            throw new AppError(
                "Invalid latitude value, Latitude value should be between -90° to 90°",
                400
            );
        }
    }

    // checks for radius
    if (radius) {
        const rad = parseFloat(radius);
        if (isNaN(rad)) {
            throw new AppError("Invalid radius value", 400);
        }
        if (rad < 0) {
            throw new AppError(
                "Invalid radius value, Radius value should be a positive Number",
                400
            );
        }
    }

    // Previous strict proximity validation removed. We'll validate after resolving city/center.

    if (startAfterDate && !isValidDate(startAfterDate)) {
        throw new AppError(
            `Invalid Date given '${startAfterDate}', formate Should be YYYY-MM-DD`,
            400
        );
    }

    if (endBeforeDate && !isValidDate(endBeforeDate)) {
        throw new AppError(
            `Invalid Date given '${endBeforeDate}', formate Should be YYYY-MM-DD`,
            400
        );
    }

    // Prepare computed proximity center; default to provided values if any
    let computedCenterLatitude = centerLatitude;
    let computedCenterLongitude = centerLongitude;

    if (endAfterDate && !isValidDate(endAfterDate)) {
        throw new AppError(
            `Invalid Date given '${endAfterDate}', formate Should be YYYY-MM-DD`,
            400
        );
    }

    if (cityId) {
        // const city = await cityRepo.getCityWithId(cityId);
        // Validate the cityId input to ensure it only contains integers separated by commas
        if (!/^\d+(,\d+)*$/.test(cityId)) {
            throw new AppError(
                `Invalid format for CityId '${cityId}'. Please provide a comma-separated list of integers.`,
                400
            );
        }

        // Parse the cityId string to an array of integers
        const cityIds = cityId.split(",").map((id) => parseInt(id.trim(), 10));

        // Retrieve cities using the parsed array of IDs
        const citiesResp = await cityRepository.getAll({
            filters: [
                {
                    key: "id",
                    sign: "IN",
                    value: cityIds
                }
            ]
        });

        // Throw an error if no cities are found
        if (!citiesResp.count) {
            throw new AppError(
                `No cities found for provided CityId(s) '${cityId}'`,
                400
            );
        }

        // Check if the number of cities retrieved matches the number of IDs provided
        if (citiesResp.count !== cityIds.length) {
            // Find missing IDs by filtering out those that were found in the database
            const foundIds = (citiesResp.rows || []).map((city) => city.id);
            const missingIds = cityIds.filter((id) => !foundIds.includes(id));
            throw new AppError(
                `The following CityId(s) are invalid: ${missingIds.join(", ")}`,
                404
            );
        }

        // Include all ancestor IDs (walk up: city → municipality → district)
        // Skip if skipParentCities flag is set
        if (skipParentCities === "true") {
            cities = cityIds;
        } else {
            const allIds = new Set(cityIds.map(Number));
            let toResolve = [...cityIds];
            const MAX_DEPTH = 5;
            for (let depth = 0; depth < MAX_DEPTH && toResolve.length > 0; depth++) {
                const parentData = await cityRepository.getAll({
                    filters: [{ key: "id", sign: "IN", value: toResolve }],
                    columns: "id,parentId"
                });
                const parentIds = parentData.rows
                    .map((c) => c.parentId)
                    .filter((pid) => pid != null && !allIds.has(Number(pid)));
                parentIds.forEach((pid) => allIds.add(Number(pid)));
                toResolve = parentIds;
            }
            cities = [...allIds];
        }

        // If a single cityId and radius are provided, and caller didn't pass center,
        // set center to the provided city's coordinates
        if (radius && cityIds.length === 1 && computedCenterLatitude == null && computedCenterLongitude == null) {
            try {
                const childCity = await cityRepository.getOne({
                    filters: [
                        { key: "id", sign: "=", value: cityIds[0] }
                    ]
                });
                if (childCity && childCity.latitude != null && childCity.longitude != null) {
                    computedCenterLatitude = childCity.latitude;
                    computedCenterLongitude = childCity.longitude;
                }
            } catch (e) {
                // ignore; leave computed center as-is
            }
        }
    } else {
        // cities = await cityRepo.getCities();
        const citiesResp = await cityRepository.getAll({
            columns: "id,name,image, hasForum",
            sort: ["name"]
        });
        cities = citiesResp?.rows?.map((city) => city.id) ?? [];
    }

    // Validate proximity usage now that cities/center are resolved
    if (radius !== undefined) {
        const hasCenter = computedCenterLatitude != null && computedCenterLongitude != null;
        // It's acceptable if user provided center OR we have a single cityId case
        let hasSingleCityId = false;
        if (cityId) {
            const tmpIds = cityId.split(",").map((id) => parseInt(id.trim(), 10)).filter((n) => !isNaN(n));
            hasSingleCityId = tmpIds.length === 1;
        }
        if (!hasCenter && !hasSingleCityId) {
            throw new AppError(
                "For proximity search, provide either (centerLatitude and centerLongitude) or a single cityId with radius.",
                400
            );
        }
    }

    if (showExternalListings !== "true") {
        // filters.sourceId = source.UserEntry;
        filters.push({
            key: "sourceId",
            sign: "=",
            value: source.UserEntry
        });
    }

    // Handle accessibility tags
    if (accessibilityTagIds) {
        // Validate input format
        if (!/^\d+(,\d+)*$/.test(accessibilityTagIds)) {
            throw new AppError(
                `Invalid format for accessibilityTagIds '${accessibilityTagIds}'. Please provide a comma-separated list of integers.`,
                400
            );
        }

        // Parse and validate individual IDs
        let parsedTags = accessibilityTagIds.split(",").map((id) => {
            const parsedId = parseInt(id.trim(), 10);
            if (isNaN(parsedId)) {
                throw new AppError(
                    `Invalid accessibility tag ID '${id}'. Must be a number.`,
                    400
                );
            }
            if (parsedId <= 0) {
                throw new AppError(
                    `Invalid accessibility tag ID '${id}'. Must be a positive integer.`,
                    400
                );
            }
            return parsedId;
        });

        // Remove duplicate IDs
        parsedTags = [...new Set(parsedTags)];

        // Check tag existence in database
        if (parsedTags.length > 0) {
            const tagsResp = await accessibilityTagsRepo.getAll({
                filters: [
                    {
                        key: "id",
                        sign: "IN",
                        value: parsedTags
                    }
                ]
            });

            const existingIds = tagsResp.rows.map((tag) => tag.id);
            const invalidIds = parsedTags.filter(
                (id) => !existingIds.includes(id)
            );

            if (invalidIds.length > 0) {
                throw new AppError(
                    `Invalid accessibility tag IDs: ${invalidIds.join(", ")}`,
                    400
                );
            }

            accessibilityTags = parsedTags;
        }
    }

    try {
        const listings = await listingRepository.retrieveListings({
            userId,
            filters,
            pageNo,
            pageSize,
            cities,
            sortByStartDate: sortByStartDateBool,
            todayFirstThenAsc,
            startAfterDate, // Start date for range
            endBeforeDate,
            centerLatitude: computedCenterLatitude,
            centerLongitude: computedCenterLongitude,
            endAfterDate,
            radius,
            accessibilityTagIds: accessibilityTags,
            isFavorite,
            statusId: effectiveStatusId
        });
        if (translate && supportedLanguages.includes(translate)) {
            try {
                // Translate all listings in parallel
                await Promise.all(
                    listings.map(async (listing) => {
                        await translateObjectValues(listing, translate, ['title', 'description', 'categoryName', 'address']);
                        // Always set language indicators when translation is requested
                        listing.titleLanguage = 'auto';
                        listing.descriptionLanguage = 'auto';
                    })
                );
            } catch (error) {
                console.error("Translation error:", error);
            }
        }
        return listings;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const searchListings = async ({
    userId,
    pageNo,
    pageSize,
    sortByStartDate,
    statusId,
    cityId,
    translate,
    searchQuery,
    isAdmin
}) => {
    const filters = [];
    let cities = [];
    let sortByStartDateBool = false;

    // Validate page parameters
    if (isNaN(Number(pageNo)) || Number(pageNo) <= 0) {
        throw new AppError("Please enter a positive integer for pageNo", 400);
    }
    if (
        isNaN(Number(pageSize)) ||
        Number(pageSize) <= 0 ||
        Number(pageSize) > 20
    ) {
        throw new AppError(
            "Please enter a positive integer less than or equal to 20 for pageSize",
            400
        );
    }

    // Get cities
    if (cityId) {
        // const city = await cityRepo.getCityWithId(cityId);
        const city = await cityRepository.getOne({
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: cityId
                }
            ]
        });
        if (!city) {
            throw new AppError(`Invalid CityId '${cityId}' given`, 400);
        }
        cities = [city];
    } else {
        // cities = await cityRepo.getCities();
        const citiesResp = await cityRepository.getAll({
            columns: "id,name,image, hasForum",
            sort: ["name"]
        });
        cities = citiesResp?.rows ?? [];
        if (cities.length === 0) {
            throw new AppError("No cities found", 404);
        }
    }

    // Validate and set sortByStartDate
    if (sortByStartDate) {
        const sortByStartDateString = sortByStartDate.toString();
        if (
            sortByStartDateString !== "true" &&
            sortByStartDateString !== "false"
        ) {
            throw new AppError(
                "The parameter sortByCreatedDate can only be a boolean",
                400
            );
        }
        sortByStartDateBool = sortByStartDateString === "true";
    }

    // statusId handled directly in retrieveListings subquery
    let effectiveStatusId;
    if (isAdmin && statusId) {
        if (isNaN(Number(statusId)) || Number(statusId) <= 0) {
            throw new AppError(`Invalid status ${statusId}`, 400);
        }
        const statusRecord = await statusRepository.getOne({
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: statusId
                }
            ]
        });
        if (!statusRecord) {
            throw new AppError(`Invalid Status '${statusId}' given`, 400);
        }
        effectiveStatusId = statusId;
    } else if (isAdmin) {
        effectiveStatusId = '*'; // admin with no filter sees all statuses
    } else {
        effectiveStatusId = status.Active;
    }

    try {
        const listings = await listingRepository.retrieveListings({
            userId,
            filters,
            cities: cities.map((city) => city.id),
            searchQuery,
            pageNo,
            pageSize,
            sortByStartDate: sortByStartDateBool,
            statusId: effectiveStatusId
        });

        if (translate && supportedLanguages.includes(translate)) {
            try {
                // Translate all listings in parallel
                await Promise.all(
                    listings.map(async (listing) => {
                        await translateObjectValues(listing, translate, ['title', 'description', 'categoryName', 'address']);
                        // Always set language indicators when translation is requested
                        listing.titleLanguage = 'auto';
                        listing.descriptionLanguage = 'auto';
                    })
                );
            } catch (error) {
                console.error("Translation error:", error);
            }
        }
        // Remove viewCount from listings
        return listings.map((listing) => {
            const { viewCount, ...listingWithoutViewCount } = listing;
            return listingWithoutViewCount;
        });
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(`Error searching listings: ${err.message}`);
    }
};

const createListing = async ({ cityIds, listingData, userId, roleId }) => {
    try {
        let effectiveCityIds = cityIds;

        if (roleId === roles.CityAdmin) {
            const adminMappings = await cityUserRolesRepository.getByUser(userId);
            const adminCityIds = adminMappings.map((m) => m.cityId);
            effectiveCityIds = (cityIds || []).filter((id) =>
                adminCityIds.includes(Number(id))
            );

            if (effectiveCityIds.length === 0) {
                throw new AppError(
                    "You are not an admin for any of the provided cities. Listing cannot be created.",
                    403
                );
            }
        }

        // Keep only top-level city IDs (e.g., don't mix cities+districts — use cities)
        effectiveCityIds = await resolveTopLevelCityIds(effectiveCityIds);

        const createdListings = await listingFunctions.createListing(
            effectiveCityIds,
            listingData,
            userId,
            roleId
        );
        return createdListings;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(`Error creating listing: ${err.message}`);
    }
};

const updateListingStatus = async ({ listingId, updates, userId, roleId }) => {
    if (!Array.isArray(updates) || updates.length === 0) {
        throw new AppError("Payload must be a non-empty array of { cityId, statusId }", 400);
    }

    const listing = await listingRepository.getOne({
        filters: [{ key: "id", sign: "=", value: listingId }]
    });
    if (!listing) {
        throw new AppError(`Listing with id ${listingId} does not exist`, 404);
    }

    const existingMappings = await cityListingMappingRepo.getAll({
        filters: [{ key: "listingId", sign: "=", value: listingId }]
    });
    const mappedCityIds = new Set(existingMappings.rows.map((m) => Number(m.cityId)));

    let allowedCityIds = null;
    if (roleId === roles.CityAdmin) {
        const adminMappings = await cityUserRolesRepository.getByUser(userId);
        allowedCityIds = new Set(adminMappings.map((m) => Number(m.cityId)));
    } else if (roleId !== roles.Admin) {
        throw new AppError("You are not allowed to update listing status", 403);
    }

    const validStatuses = await statusRepository.getAll({});
    const validStatusIds = new Set(validStatuses.rows.map((s) => Number(s.id)));

    for (const entry of updates) {
        const cityId = Number(entry.cityId);
        const statusId = Number(entry.statusId);

        if (!cityId || isNaN(cityId)) {
            throw new AppError(`Invalid cityId: ${entry.cityId}`, 400);
        }
        if (!statusId || isNaN(statusId)) {
            throw new AppError(`Invalid statusId: ${entry.statusId}`, 400);
        }
        if (!validStatusIds.has(statusId)) {
            throw new AppError(`Status with id ${statusId} does not exist`, 400);
        }
        if (!mappedCityIds.has(cityId)) {
            throw new AppError(
                `City ${cityId} is not mapped to listing ${listingId}`,
                400
            );
        }
        if (allowedCityIds !== null && !allowedCityIds.has(cityId)) {
            throw new AppError(
                `You do not have admin rights for city ${cityId}`,
                403
            );
        }
    }

    let transaction;
    try {
        transaction = await listingRepository.createTransaction();

        for (const entry of updates) {
            await cityListingMappingRepo.updateWithTransaction(
                {
                    data: { statusId: Number(entry.statusId) },
                    filters: [
                        { key: "listingId", sign: "=", value: listingId },
                        { key: "cityId", sign: "=", value: Number(entry.cityId) }
                    ]
                },
                transaction
            );
        }

        await listingRepository.commitTransaction(transaction);

        return updates.map((e) => ({
            cityId: Number(e.cityId),
            statusId: Number(e.statusId)
        }));
    } catch (err) {
        if (transaction) {
            await listingRepository.rollbackTransaction(transaction);
        }
        if (err instanceof AppError) throw err;
        throw new AppError(`Error updating listing status: ${err.message}`);
    }
};


const updateListing = async ({
    listingId,
    cityIds,
    listingData,
    userId,
    roleId
}) => {
    try {
        // Keep only top-level city IDs before updating mappings
        const effectiveCityIds = cityIds && cityIds.length > 0
            ? await resolveTopLevelCityIds(cityIds)
            : cityIds;

        const updatedListing = await listingFunctions.updateListing(
            listingId,
            effectiveCityIds,
            listingData,
            userId,
            roleId
        );
        return updatedListing;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(`Error updating listing: ${err.message}`);
    }
};

const getListingWithId = async function (id, userId, repeatedRequest = false, translate) {
    try {
        // Retrieve the listing data.
        const data = await listingRepository.getOne({
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: id
                }
            ]
        });
        if (!data) {
            throw new AppError(`Listings with id ${id} does not exist`, 404);
        }

        // add accessibility tags to the listing data
        const listingAccessibilityTags = await listingAccessibilityTagsRepo.getAll({
            filters: [
                {
                    key: "listingId",
                    sign: "=",
                    value: id
                }]
        });

        const listingAccessibilityTagIds = listingAccessibilityTags.rows.map((tag) => tag.tagId);

        let accessibilityTags = [];

        if (listingAccessibilityTagIds.length > 0) {
            const accessibilityTagsData = await accessibilityTagsRepo.getAll({
                filters: [
                    {
                        key: "id",
                        sign: "IN",
                        value: listingAccessibilityTagIds
                    }
                ]
            });
            accessibilityTags = accessibilityTagsData.rows;
        }

        data.accessibilityTags = accessibilityTags.map((tag) => tag.name);

        // Retrieve city mapping for listing.
        const cityListingMappings = await cityListingMappingRepo.getAll({
            filters: [
                {
                    key: "listingId",
                    sign: "=",
                    value: id
                }
            ]
        });
        const directCityIds = cityListingMappings.rows.map(
            (cityListingMapping) => cityListingMapping.cityId
        );

        // Walk up the parent hierarchy and collect all ancestor city IDs
        const resolveAncestorCityIds = async (cityIds) => {
            const allIds = new Set(cityIds.map(Number));
            let toResolve = [...cityIds];
            const MAX_DEPTH = 5; // safety cap against circular references
            for (let depth = 0; depth < MAX_DEPTH && toResolve.length > 0; depth++) {
                const citiesData = await cityRepository.getAll({
                    filters: [{ key: "id", sign: "IN", value: toResolve }],
                    columns: "id,parentId"
                });
                const parentIds = citiesData.rows
                    .map((c) => c.parentId)
                    .filter((pid) => pid != null && !allIds.has(Number(pid)));
                parentIds.forEach((pid) => allIds.add(Number(pid)));
                toResolve = parentIds;
            }
            return [...allIds];
        };

        const allCities = directCityIds.length > 0
            ? await resolveAncestorCityIds(directCityIds)
            : [];

        data.allCities = allCities;
        data.cityId = directCityIds.length > 0 ? directCityIds[0] : null;

        const listingImageListResp = await listingImagesRepository.getAll({
            filters: [
                {
                    key: "listingId",
                    sign: "=",
                    value: id
                }
            ]
        });
        const listingImageList = listingImageListResp.rows;
        const logo =
            listingImageList && listingImageList.length > 0
                ? listingImageList[0].logo
                : null;

        // Increment view count if flag is set and this isn't a repeated request.
        if (process.env.IS_LISTING_VIEW_COUNT && !repeatedRequest) {
            await listingRepository.update({
                data: {
                    viewCount: data.viewCount + 1
                },
                filters: [
                    {
                        key: "id",
                        sign: "=",
                        value: id
                    }
                ]
            });
        }

        // Retrieve poll options if the listing is in the Polls category.
        if (data.categoryId === categories.Polls) {
            const pollOptionResp = await pollRepository.getAll({
                filters: [
                    {
                        key: "listingId",
                        sign: "=",
                        value: id
                    }
                ]
            });
            data.pollOptions = pollOptionResp?.rows ?? [];
        }

        // Now, add the "isFavorite" flag.
        // If the user is authenticated (userId is provided), check for a favorite record.
        if (userId != null) {
            // Attempt to get one favorite record for this listing and user.
            const favoriteRecord = await favoritesRepository.getOne({
                filters: [
                    {
                        key: "listingId",
                        sign: "=",
                        value: id
                    },
                    {
                        key: "userId",
                        sign: "=",
                        value: userId
                    }
                ]
            });
            data.isFavorite = !!favoriteRecord;
        } else {
            // No user is logged in, default isFavorite to false.
            data.isFavorite = false;
        }

        // Remove viewCount before returning (if necessary)
        delete data.viewCount;

        if (translate && supportedLanguages.includes(translate)) {
            try {
                // Translate the listing directly
                await translateObjectValues(data, translate, ['title', 'description', 'address', 'place']);
                // Always set language indicators when translation is requested
                data.titleLanguage = 'auto';
                data.descriptionLanguage = 'auto';
            } catch (error) {
                console.error("Translation error:", error);
            }
        }

        return { ...data, logo, otherLogos: listingImageList };
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const deleteListing = async function (id, userId, roleId) {
    const currentListingData = await listingRepository.getOne({
        filters: [
            {
                key: "id",
                sign: "=",
                value: id
            }
        ]
    });
    if (!currentListingData) {
        throw new AppError(`Listing with id ${id} does not exist`, 404);
    }

    if (currentListingData.userId !== userId && roleId !== roles.Admin) {
        if (roleId === roles.CityAdmin && await isCityAdminForListing(userId, id)) {
            // CityAdmin is allowed — continue
        } else {
            throw new AppError(`You are not allowed to access this resource`, 403);
        }
    }

    try {
        const userImageList = await bucketClient.fetchUserImages(
            userId,
            null,
            id
        );

        const imagesToDelete = userImageList
            .map((image) => ({ Key: image.Key._text }))
            .filter(
                (image) =>
                    typeof image.Key === "string" &&
                    image.Key &&
                    !image.Key.startsWith("admin/")
            );

        if (imagesToDelete && imagesToDelete.length > 0) {
            await imageDeleteAsync.deleteMultiple(imagesToDelete);
        }

        await listingImagesRepository.delete({
            filters: [
                {
                    key: "listingId",
                    sign: "=",
                    value: id
                }
            ]
        });

        await listingAccessibilityTagsRepo.delete({
            filters: [
                {
                    key: "listingId",
                    sign: "=",
                    value: id
                }
            ]
        });

        await listingRepository.delete({
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: id
                }
            ]
        });
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const uploadImage = async function (
    listingId,
    userId,
    roleId,
    imageFiles,
    imageList
) {
    if (isNaN(Number(listingId)) || Number(listingId) <= 0) {
        throw new AppError(`Invalid ListingsId ${listingId} given`, 400);
    }

    const currentListingData = await listingRepository.getOne({
        filters: [
            {
                key: "id",
                sign: "=",
                value: listingId
            }
        ]
    });
    if (!currentListingData) {
        throw new AppError(`Listing with id ${listingId} does not exist`, 404);
    }

    if (currentListingData.userId !== userId && roleId !== roles.Admin) {
        if (roleId === roles.CityAdmin && await isCityAdminForListing(userId, listingId)) {
            // CityAdmin is allowed — continue
        } else {
            throw new AppError(`You are not allowed to access this resource`, 403);
        }
    }

    if (currentListingData.pdf && currentListingData.pdf.length > 0) {
        throw new AppError(
            `Pdf is present in listing So can not upload image.`,
            403
        );
    }

    const imageArr = imageFiles
        ? imageFiles.length > 1
            ? imageFiles
            : [imageFiles]
        : [];
    const hasIncorrectMime = imageArr.some(
        (i) => !i.mimetype.includes("image/")
    );
    if (hasIncorrectMime) {
        throw new AppError(`Invalid Image type`, 403);
    }

    let imageOrder = 0;
    // const listingImages = await cityListingRepo.getListingImages(
    const listingImagesResp = await listingImagesRepository.getAll({
        filters: [
            {
                key: "listingId",
                sign: "=",
                value: listingId
            }
        ]
    });
    const listingImages = listingImagesResp.rows;
    if (
        listingImages &&
        listingImages.length > 0 &&
        listingImages[0].logo &&
        listingImages[0].logo.startsWith("admin/")
    ) {
        // await cityListingRepo.deleteListingImage(listingId, cityId);
        await listingImagesRepository.delete({
            filters: [
                {
                    key: "listingId",
                    sign: "=",
                    value: listingId
                }
            ]
        });
    } else {
        const imagesToRetain = listingImages.filter((value) =>
            (imageList || []).includes(value.logo)
        );
        const imagesToDelete = listingImages.filter(
            (value) =>
                !imagesToRetain.map((i2r) => i2r.logo).includes(value.logo)
        );

        if (imagesToDelete && imagesToDelete.length > 0) {
            await imageDeleteAsync.deleteMultiple(
                imagesToDelete.map((i) => i.logo)
            );
            // await cityListingRepo.deleteListingImageById(
            //     imagesToDelete.map((i) => i.id),
            //     cityId,
            // );
            await listingImagesRepository.delete({
                filters: [
                    {
                        key: "id",
                        sign: "IN",
                        value: imagesToDelete.map((i) => i.id)
                    }
                ]
            });
        }

        if (imagesToRetain && imagesToRetain.length > 0) {
            for (const imageToRetain of imagesToRetain) {
                // await cityListingRepo.updateListingImage(
                //     imageToRetain.id,
                //     { imageOrder: ++imageOrder },
                //     cityId,
                // );
                await listingImagesRepository.update({
                    data: { imageOrder: ++imageOrder },
                    filters: [
                        {
                            key: "id",
                            sign: "=",
                            value: imageToRetain.id
                        }
                    ]
                });
            }
        }
        if (imagesToRetain.length === 0 && imageArr.length === 0) {
            await addDefaultImage(listingId, currentListingData.categoryId);
        }
    }

    try {
        for (const individualImage of imageArr) {
            imageOrder++;
            const filePath = `user_${userId}/listing_${listingId}_${imageOrder}_${Date.now()}`;
            const { uploadStatus, objectKey } = await imageUpload(
                individualImage,
                filePath
            );
            if (uploadStatus === "Success") {
                // await cityListingRepo.createListingImage(
                //     cityId,
                //     listingId,
                //     imageOrder,
                //     objectKey,
                // );
                await listingImagesRepository.create({
                    data: {
                        listingId,
                        imageOrder,
                        logo: objectKey
                    }
                });
            } else {
                throw new AppError("Image Upload failed");
            }
        }
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const uploadPDF = async function (listingId, userId, roleId, pdf) {
    if (isNaN(Number(listingId)) || Number(listingId) <= 0) {
        throw new AppError(`Invalid ListingsId ${listingId} given`, 400);
    }

    const currentListingData = await listingRepository.getOne({
        filters: [
            {
                key: "id",
                sign: "=",
                value: listingId
            }
        ]
    });
    if (!currentListingData) {
        throw new AppError(`Listing with id ${listingId} does not exist`, 404);
    }

    if (currentListingData.userId !== userId && roleId !== roles.Admin) {
        if (roleId === roles.CityAdmin && await isCityAdminForListing(userId, listingId)) {
            // CityAdmin is allowed — continue
        } else {
            throw new AppError(`You are not allowed to access this resource`, 403);
        }
    }

    if (currentListingData.logo && currentListingData.logo.length > 0) {
        throw new AppError(
            `Image is present in listing So can not upload pdf.`,
            403
        );
    }

    if (!pdf) {
        throw new AppError(`Pdf not uploaded`, 400);
    }

    const arrayOfAllowedFiles = ["pdf"];
    const arrayOfAllowedFileTypes = ["application/pdf"];

    const fileExtension = pdf.name.slice(
        ((pdf.name.lastIndexOf(".") - 1) >>> 0) + 2
    );

    if (
        !arrayOfAllowedFiles.includes(fileExtension) ||
        !arrayOfAllowedFileTypes.includes(pdf.mimetype)
    ) {
        throw new AppError(`Invalid Pdf type`, 403);
    }

    // const imagesToDelete = await cityListingRepo.getListingImages(
    //     listingId,
    //     cityId,
    // );
    const imagesToDeleteResp = await listingImagesRepository.getAll({
        filters: [
            {
                key: "listingId",
                sign: "=",
                value: listingId
            }
        ]
    });
    const imagesToDelete = imagesToDeleteResp.rows;
    if (imagesToDelete && imagesToDelete.length > 0) {
        await imageDeleteAsync.deleteMultiple(
            imagesToDelete
                .map((i) => i.logo)
                .filter(
                    (i) => typeof i === "string" && i && !i.startsWith("admin/")
                )
        );
        // await cityListingRepo.deleteMultipleListingImagesById(
        //     imagesToDelete.map((i) => i.id),
        //     cityId,
        // );
        await listingImagesRepository.delete({
            filters: [
                {
                    key: "id",
                    sign: "IN",
                    value: imagesToDelete.map((i) => i.id)
                }
            ]
        });
    }

    try {
        const filePath = `user_${userId}/listing_${listingId}_${Date.now()}_PDF.pdf`;
        const { uploadStatus, objectKey } = await pdfUpload(pdf, filePath);
        const pdfUploadStatus = uploadStatus;
        const pdfObjectKey = objectKey;

        const updationData = { pdf: pdfObjectKey };
        const pdfBucketPath =
            "https://" +
            process.env.BUCKET_NAME +
            "." +
            process.env.BUCKET_HOST;

        if (pdfUploadStatus === "Success") {
            // create image
            const pdfFilePath = `${pdfBucketPath}/${filePath}`;
            const imageOrder = 1;
            const imagePath = `user_${userId}/listing_${listingId}_${imageOrder}`;
            const pdfImageBuffer = await getPdfImage(pdfFilePath);
            const { uploadStatus, objectKey } = await imageUpload(
                pdfImageBuffer,
                imagePath
            );

            if (uploadStatus === "Success") {
                await listingImagesRepository.create({
                    data: {
                        listingId,
                        imageOrder,
                        logo: objectKey
                    }
                });
            }

            await listingRepository.update({
                data: updationData,
                filters: [
                    {
                        key: "id",
                        sign: "=",
                        value: listingId
                    }
                ]
            });
        } else {
            throw new AppError("pdf Upload failed");
        }
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const deleteImage = async function (id, userId, roleId) {
    if (isNaN(Number(id)) || Number(id) <= 0) {
        throw new AppError(`Invalid ListingsId ${id}`, 404);
    }

    // The current user might not be in the city db
    const currentListingData = await listingRepository.getOne({
        filters: [
            {
                key: "id",
                sign: "=",
                value: id
            }
        ]
    });
    if (!currentListingData) {
        throw new AppError(`Listing with id ${id} does not exist`, 404);
    }

    if (currentListingData.userId !== userId && roleId !== roles.Admin) {
        if (roleId === roles.CityAdmin && await isCityAdminForListing(userId, id)) {
            // CityAdmin is allowed — continue
        } else {
            throw new AppError(`You are not allowed to access this resource`, 403);
        }
    }

    // todo: move this to a separate layer
    let imageList = await axios.get(
        "https://" + process.env.BUCKET_NAME + "." + process.env.BUCKET_HOST
    );
    imageList = JSON.parse(
        parser.xml2json(imageList.data, { compact: true, spaces: 4 })
    );

    const userListingFilter = `user_${userId}/listing_${id}`;
    const userImageList = imageList.ListBucketResult.Contents.filter((obj) =>
        obj.Key._text.includes(userListingFilter)
    ).filter((obj) => !obj.Key._text.includes("admin/"));

    const imagesToDelete = userImageList.map((image) => ({
        Key: image.Key._text
    }));

    try {
        if (imagesToDelete && imagesToDelete.length > 0) {
            await imageDeleteAsync.deleteMultiple(
                imagesToDelete.map((i) => i.Key)
            );
        }

        await listingImagesRepository.delete({
            filters: [
                {
                    key: "listingId",
                    sign: "=",
                    value: id
                }
            ]
        });
        await addDefaultImage(id, currentListingData.categoryId);
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const deletePDF = async function (id, userId, roleId) {
    if (isNaN(Number(id)) || Number(id) <= 0) {
        throw new AppError(`Invalid ListingsId ${id}`, 404);
    }

    // The current user might not be in the city db
    const currentListingData = await listingRepository.getOne({
        filters: [
            {
                key: "id",
                sign: "=",
                value: id
            }
        ]
    });
    if (!currentListingData) {
        throw new AppError(`Listing with id ${id} does not exist`, 404);
    }

    if (currentListingData.userId !== userId && roleId !== roles.Admin) {
        if (roleId === roles.CityAdmin && await isCityAdminForListing(userId, id)) {
            // CityAdmin is allowed — continue
        } else {
            throw new AppError(`You are not allowed to access this resource`, 403);
        }
    }

    try {
        if (currentListingData.pdf) {
            await imageDeleteAsync.deleteImage(currentListingData.pdf);
        }

        const updationData = {
            pdf: ""
        };

        await listingRepository.update({
            data: updationData,
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: id
                }
            ]
        });
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

async function addDefaultImage(listingId, categoryId) {
    const imageOrder = 1;
    const categoryName = Object.keys(categories).find(
        (key) => categories[key] === +categoryId
    );

    // const categoryCount = await cityListingRepo.getCountByCategory(
    const categoryCountResponse = await listingImagesRepository.getAll({
        filters: [
            {
                key: "logo",
                sign: "LIKE",
                value: `%${categoryName}%`
            }
        ],
        columns: "COUNT(id) AS count"
    });
    const categoryCount = categoryCountResponse.count;

    const moduloValue = (categoryCount % defaultImageCount[categoryName]) + 1;
    const imageName = `admin/${categoryName}/${DEFAULTIMAGE}${moduloValue}.png`;

    return await listingImagesRepository.create({
        data: {
            listingId,
            imageOrder,
            logo: imageName
        }
    });
}

const vote = async function (listingId, optionId, vote) {
    if (isNaN(Number(listingId)) || Number(listingId) <= 0) {
        throw new AppError(`Invalid ListingsId ${listingId} given`, 400);
    }

    if (!optionId || isNaN(Number(optionId)) || Number(optionId) <= 0) {
        throw new AppError(`Invalid OptionId ${optionId} given`, 400);
    }

    if (isNaN(Number(vote)) || (Number(vote) !== 1 && Number(vote) !== -1)) {
        throw new AppError(`Invalid Vote ${vote} given`, 400);
    }

    const currentCityListing = await listingRepository.getOne({
        filters: [
            {
                key: "id",
                sign: "=",
                value: listingId
            }
        ]
    });
    if (!currentCityListing) {
        throw new AppError(`Listing with id ${listingId} does not exist`, 404);
    }

    if (currentCityListing.categoryId !== categories.Polls) {
        throw new AppError(`This listing is not a poll`, 400);
    }

    // const pollOptions = await pollRepo.getPollOptions(listingId, cityId);
    const pollOptionsResp = await pollRepository.getAll({
        filters: [
            {
                key: "listingId",
                sign: "=",
                value: listingId
            }
        ]
    });
    const pollOptions = pollOptionsResp?.rows ?? [];
    if (!pollOptions || pollOptions.length === 0) {
        throw new AppError(`No poll options found for this listing`, 404);
    }
    try {
        const pollOption = pollOptions.find((option) => option.id === optionId);
        if (!pollOption) {
            throw new AppError(`OptionId not found`, 404);
        }

        const voteCount = pollOption.votes + vote;
        if (voteCount < 0) {
            throw new AppError(`Vote count cannot be negative`, 400);
        }

        // await pollRepo.updatePollOptionVotes(optionId, voteCount, cityId);
        await pollRepository.update({
            data: { votes: voteCount },
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: optionId
                }
            ]
        });
        return voteCount;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

// Recommendations: mixed categories with category-specific sorting
const getRecommendations = async ({ userId, cityId, count = 4, translate, categoryId }) => {
    // Define category rules
    const CATEGORY_SORTING = {
        1: { sortByStartDate: true, todayFirstThenAsc: false, endBeforeDate: 'today' },
        3: { sortByStartDate: true, todayFirstThenAsc: true, startAfterDate: 'today' },
        41: { sortByStartDate: true, todayFirstThenAsc: true, startAfterDate: 'today' },
        // 48: { sortByStartDate: true, todayFirstThenAsc: true, startAfterDate: 'today' }
    };

    const perCategoryQuota = 1;
    const preferredFillOrder = [3, 1, 41, 48];

    // Resolve cities similar to getAllListings
    let cities = [];
    if (cityId) {
        if (!/^\d+(,\d+)*$/.test(cityId)) {
            throw new AppError(
                `Invalid format for CityId '${cityId}'. Please provide a comma-separated list of integers.`,
                400
            );
        }
        cities = cityId.split(",").map((id) => parseInt(id.trim(), 10));
        const citiesResp = await cityRepository.getAll({
            filters: [
                { key: "id", sign: "IN", value: cities }
            ]
        });
        if (!citiesResp.count) {
            throw new AppError(
                `No cities found for provided CityId(s) '${cityId}'`,
                400
            );
        }
        if (citiesResp.count !== cities.length) {
            const foundIds = citiesResp.map((city) => city.id);
            const missingIds = cities.filter((id) => !foundIds.includes(id));
            throw new AppError(
                `The following CityId(s) are invalid: ${missingIds.join(", ")}`,
                404
            );
        }
    } else {
        const citiesResp = await cityRepository.getAll({
            columns: "id",
            sort: ["name"]
        });
        cities = citiesResp?.rows?.map((c) => c.id) ?? [];
    }
    console.log({ cities })

    const todayStr = new Date().toISOString().split("T")[0];
    const collected = [];
    const usedIds = new Set();
    const categorySelectedCount = new Map();

    const fetchForCategory = async (catId, limit, alreadySelected = 0) => {
        const rule = CATEGORY_SORTING[catId] || {};
        const startAfterDate = rule.startAfterDate === 'today' ? todayStr : rule.startAfterDate;
        const endBeforeDate = rule.endBeforeDate === 'today' ? todayStr : rule.endBeforeDate;

        const items = await listingRepository.retrieveListings({
            userId,
            filters: [
                { key: "statusId", sign: "=", value: status.Active },
                { key: "categoryId", sign: "=", value: catId }
            ],
            cities,
            pageNo: 1,
            pageSize: Math.max(limit + (alreadySelected || 0), 1),
            sortByStartDate: !!rule.sortByStartDate,
            todayFirstThenAsc: !!rule.todayFirstThenAsc,
            startAfterDate: startAfterDate || null,
            endBeforeDate: endBeforeDate || null
        });

        // De-duplicate and cap to requested limit
        const newOnes = [];
        for (const item of items) {
            if (!usedIds.has(item.id)) {
                usedIds.add(item.id);
                newOnes.push(item);
                if (newOnes.length >= limit) break;
            }
        }
        return newOnes;
    };

    // If a specific category is requested, fetch random items from that category and return
    if (categoryId) {
        const parsedCatId = parseInt(categoryId, 10);
        if (isNaN(parsedCatId)) {
            throw new AppError(`Invalid CategoryId '${categoryId}' given`, 400);
        }

        const rule = CATEGORY_SORTING[parsedCatId] || {};
        const startAfterDate = rule.startAfterDate === 'today' ? todayStr : rule.startAfterDate;
        const endBeforeDate = rule.endBeforeDate === 'today' ? todayStr : rule.endBeforeDate;

        // Fetch a larger pool, then shuffle client-side for randomness
        const poolSize = Math.max(count * 5, 20);
        const pool = await listingRepository.retrieveListings({
            userId,
            filters: [
                { key: "statusId", sign: "=", value: status.Active },
                { key: "categoryId", sign: "=", value: parsedCatId }
            ],
            cities,
            pageNo: 1,
            pageSize: poolSize,
            sortByStartDate: !!rule.sortByStartDate,
            todayFirstThenAsc: !!rule.todayFirstThenAsc,
            startAfterDate: startAfterDate || null,
            endBeforeDate: endBeforeDate || null
        });

        // Shuffle (Fisher-Yates)
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        const result = pool.slice(0, count);

        if (translate && supportedLanguages.includes(translate)) {
            try {
                await Promise.all(
                    result.map(async (listing) => {
                        await translateObjectValues(listing, translate, ['title', 'description', 'categoryName', 'address']);
                    })
                );
            } catch (error) {
                console.error("Translation error:", error);
            }
        }

        return result;
    }

    // Step 1: try to get perCategoryQuota from each category
    const categoryIds = Object.keys(CATEGORY_SORTING).map((k) => parseInt(k, 10));
    for (const catId of categoryIds) {
        if (collected.length >= count) break;
        const need = Math.min(perCategoryQuota, count - collected.length);
        const already = categorySelectedCount.get(catId) || 0;
        const got = await fetchForCategory(catId, need, already);
        collected.push(...got);
        if (got.length > 0) {
            categorySelectedCount.set(catId, (categorySelectedCount.get(catId) || 0) + got.length);
        }
    }

    // Step 2: fill remaining from preferred categories (round-robin, one-by-one)
    if (collected.length < count) {
        // We'll loop over preferredFillOrder and fetch 1 at a time per category
        while (collected.length < count) {
            let addedThisCycle = false;
            for (const catId of preferredFillOrder) {
                if (collected.length >= count) break;
                const already = categorySelectedCount.get(catId) || 0;
                const got = await fetchForCategory(catId, 1, already);
                if (got.length > 0) {
                    collected.push(got[0]);
                    addedThisCycle = true;
                    categorySelectedCount.set(catId, already + 1);
                }
            }
            if (!addedThisCycle) break;
        }
    }

    // Step 3: global sort
    const now = new Date();
    const isFuture = (d) => d && new Date(d) >= new Date(now.toDateString());

    collected.sort((a, b) => {
        const aStart = a.startDate;
        const bStart = b.startDate;
        const aFuture = isFuture(aStart);
        const bFuture = isFuture(bStart);

        // Upcoming first
        if (aFuture && !bFuture) return -1;
        if (!aFuture && bFuture) return 1;

        // Both upcoming: earlier first
        if (aFuture && bFuture) {
            return new Date(aStart) - new Date(bStart);
        }

        // Both past or no startDate: newer first (by startDate else createdAt)
        const aRef = aStart ? new Date(aStart) : new Date(a.createdAt);
        const bRef = bStart ? new Date(bStart) : new Date(b.createdAt);
        return bRef - aRef;
    });

    // Trim to count
    const result = collected.slice(0, count);

    if (translate && supportedLanguages.includes(translate)) {
        try {
            await Promise.all(
                result.map(async (listing) => {
                    await translateObjectValues(listing, translate, ['title', 'description', 'categoryName', 'address']);
                })
            );
        } catch (error) {
            console.error("Translation error:", error);
        }
    }

    return result;
};

const getPoiCoordinates = async ({ categoryId }) => {

    const activeStatus = status.Active;

    let categoryIds = [];
    if (categoryId) {
        if (!/^\d+(,\d+)*$/.test(categoryId)) {
            throw new AppError(
                `Invalid format for CategoryId '${categoryId}'. Please provide a comma-separated list of integers.`,
                400
            );
        }
        categoryIds = categoryId.split(",").map((id) => parseInt(id.trim(), 10));
    }

    const rows = await listingRepository.retrievePoiCoordinates({
        statusId: activeStatus,
        categoryIds,
    });

    return rows;
};

module.exports = {
    getAllListings,
    searchListings,
    createListing,
    deleteListing,
    updateListing,
    updateListingStatus,
    getListingWithId,
    uploadImage,
    uploadPDF,
    deleteImage,
    deletePDF,
    vote,
    getRecommendations,
    getPoiCoordinates
};
