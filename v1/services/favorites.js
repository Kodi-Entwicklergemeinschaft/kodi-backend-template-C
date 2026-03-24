const AppError = require("../utils/appError");

const favoritesRepository = require("../repository/favoritesRepo");
const favoriteCitiesRepository = require("../repository/userFavoriteCitiesRepo");
const citiesrepository = require("../repository/citiesRepo");
const listingRepository = require("../repository/listingsRepo");
const categoriesRepository = require("../repository/categoriesRepo");
const supportedLanguages = require("../constants/supportedLanguages");
const { translateObjectValues } = require("./translationService");
const isValidDate = require("../utils/validateDate");

const getAllFavoritesForUser = async function (userId) {
    if (!userId) {
        throw new AppError(`You are not allowed to access this resource`, 403);
    }
    try {
        // return await favoritesRepo.getFavoritesforUser(paramUserId);
        const response = await favoritesRepository.getAll({
            filters: [
                {
                    key: "userId",
                    sign: "=",
                    value: userId
                }
            ]
        });
        return response?.rows ?? [];
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const getFavoriteCitiesForUser = async function ({ userId, cityId, pageNo = 1, pageSize = 10 }) {
    if (!userId) {
        throw new AppError(`You are not allowed to access this resource`, 403);
    }
    // Validate pagination
    const pageNoNum = Number(pageNo);
    const pageSizeNum = Number(pageSize);
    if (isNaN(pageNoNum) || pageNoNum <= 0) {
        throw new AppError("Please enter a positive integer for pageNo", 400);
    }
    if (isNaN(pageSizeNum) || pageSizeNum <= 0 || pageSizeNum > 20) {
        throw new AppError(
            "Please enter a positive integer less than or equal to 20 for pageSize",
            400
        );
    }
    try {
        const cityRows = await favoriteCitiesRepository.retrieveFavoriteCitiesWithJoin({
            userId,
            cityId,
            pageNo: pageNoNum,
            pageSize: pageSizeNum,
            isDescending: true,
        });
        return cityRows;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const getFavoriteListingsForUser = async function (
    {
        userId,
        pageNo,
        pageSize,
        categoryId,
        cityId,
        translate,
        startAfterDate,
        endBeforeDate,
        centerLatitude,
        centerLongitude,
        radius,
    }
) {
    let listings = [];
    // const listingFilter = {};
    // const favFilter = {
    //     userId: paramUserId,
    // };
    const favFilters = [
        {
            key: "userId",
            sign: "=",
            value: userId
        }
    ];

    const listingFilters = [];
    if (!userId) {
        throw new AppError(`You are not allowed to access this resource`, 403);
    }

    if (isNaN(pageNo) || pageNo <= 0) {
        throw new AppError("Please enter a positive integer for pageNo", 400);
    }

    if (isNaN(pageSize) || pageSize <= 0 || pageSize > 20) {
        throw new AppError(
            "Please enter a positive integer less than or equal to 20 for pageSize",
            400
        );
    }

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

    // Validate centerLongitude
    if (centerLongitude !== undefined && centerLongitude !== null) {
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

    // Validate centerLatitude
    if (centerLatitude !== undefined && centerLatitude !== null) {
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

    // Validate radius
    if (radius !== undefined && radius !== null) {
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

    let computedCenterLatitude = centerLatitude;
    let computedCenterLongitude = centerLongitude;

    if (categoryId) {
        // Validate the categoryId input to ensure it only contains integers separated by commas
        if (!/^\d+(,\d+)*$/.test(categoryId)) {
            throw new AppError(
                `Invalid format for CategoryId '${categoryId}'. Please provide a comma-separated list of integers.`,
                400
            );
        }

        const categoryIds = categoryId.split(",").map((id) => parseInt(id.trim(), 10));
        const singleCategoryId = categoryIds.length === 1 ? categoryIds[0] : null;

        // Check categories exist and are enabled
        const data = await categoriesRepository.getAll({
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
        if (!data || !data.count) {
            throw new AppError(
                `No categories found for provided CategoryId(s) '${categoryIds.join(', ')}'`,
                400
            );
        }

        if (singleCategoryId !== null) {
            listingFilters.push({
                key: "categoryId",
                sign: "=",
                value: singleCategoryId
            });
        } else {
            listingFilters.push({
                key: "categoryId",
                sign: "IN",
                value: categoryIds
            });
        }
    }

    let cities = [];
    if (cityId) {
        // Validate the cityId input to ensure it only contains integers separated by commas
        if (!/^\d+(,\d+)*$/.test(cityId)) {
            throw new AppError(
                `Invalid format for CityId '${cityId}'. Please provide a comma-separated list of integers.`,
                400
            );
        }

        const cityIds = cityId.split(",").map((id) => parseInt(id.trim(), 10));

        const citiesResp = await citiesrepository.getAll({
            filters: [
                {
                    key: "id",
                    sign: "IN",
                    value: cityIds
                }
            ]
        });

        if (!citiesResp.count) {
            throw new AppError(
                `No cities found for provided CityId(s) '${cityId}'`,
                400
            );
        }

        // Ensure all ids exist
        if (citiesResp.count !== cityIds.length) {
            const foundIds = (citiesResp.rows || []).map((city) => city.id);
            const missingIds = cityIds.filter((id) => !foundIds.includes(id));
            throw new AppError(
                `The following CityId(s) are invalid: ${missingIds.join(", ")}`,
                404
            );
        }

        // Include parentId(s)
        const parentIds = (citiesResp.rows || [])
            .map((c) => c.parentId)
            .filter((pid) => pid !== null && pid !== undefined);
        const combined = [...cityIds, ...parentIds];
        cities = [...new Set(combined)];

        if (radius && cityIds.length === 1 && computedCenterLatitude == null && computedCenterLongitude == null) {
            try {
                const childCity = await citiesrepository.getOne({
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

        // Also narrow favorites query by these cityIds
        favFilters.push({
            key: "cityId",
            sign: cities.length > 1 ? "IN" : "=",
            value: cities.length > 1 ? cities : cities[0]
        });
    }

    // Validate proximity usage now that cities/center are resolved
    if (radius !== undefined && radius !== null) {
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

    try {
        const response = await favoritesRepository.getAll({
            filters: favFilters
        });
        const favListingIds = response?.rows?.map((fav) => fav.listingId) ?? [];

        if (favListingIds.length === 0) {
            return [];
        }

        listingFilters.push({
            key: "id",
            sign: "IN",
            value: favListingIds
        });

        // If cities not specified explicitly above, derive from favorites rows (dedup)
        if (cities.length === 0) {
            cities = [
                ...new Set(response?.rows?.map((fav) => fav.cityId) ?? [])
            ];
        }

        const listingResponse = await listingRepository.retrieveListings({
            userId,
            filters: listingFilters,
            cities,
            orderByFavoritesCreated: true,
            centerLatitude: computedCenterLatitude,
            centerLongitude: computedCenterLongitude,
            radius,
            isFavorite: true,
            pageNo,
            pageSize,
            startAfterDate, // Start date for range
            endBeforeDate,
        });
        listings = listingResponse ?? [];

        if (translate && supportedLanguages.includes(translate)) {
            try {
                // Translate all listings in parallel
                await Promise.all(
                    listings.map(async (listing) => {
                        await translateObjectValues(listing, translate, ['title', 'description', 'subtitle', 'categoryName' ,'address']);
                        // Set language indicators for each listing
                        if (listing.title) listing.titleLanguage = 'auto';
                        if (listing.description) listing.descriptionLanguage = 'auto';
                    })
                );
            } catch (error) {
                console.error("Translation error:", error);
            }
        }
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
    return listings;
};

const addNewFavoriteForUser = async function (
    userId,
    cityId,
    listingId
) {
    if (!userId) {
        throw new AppError(`You are not allowed to access this resource`, 403);
    }

    if (isNaN(Number(cityId)) || Number(cityId) <= 0) {
        throw new AppError(`Invalid cityId`, 400);
    } else {
        try {
            const response = await citiesrepository.getOne({
                filters: [
                    {
                        key: "id",
                        sign: "=",
                        value: cityId
                    }
                ]
            });
            if (!response) {
                throw new AppError(`Invalid City '${cityId}' given`, 400);
            }
        } catch (err) {
            if (err instanceof AppError) throw err;
            throw new AppError(err);
        }
    }
    if (isNaN(Number(listingId)) || Number(listingId) <= 0) {
        throw new AppError(`Invalid ListingsId ${listingId}`, 400);
    } else {
        try {
            // const response = await listingRepo.getCityListingWithId(
            //     listingId,
            //     cityId,
            // );
            const response = await listingRepository.retrieveListings({
                filters: [
                    {
                        key: "id",
                        sign: "=",
                        value: listingId
                    }
                ],
                cities: [cityId]
            });
            if (!response) {
                throw new AppError(`Invalid listing '${listingId}' given`, 400);
            }
        } catch (err) {
            if (err instanceof AppError) throw err;
            throw new AppError(err);
        }
    }

    // Check if the favorite already exists
    try {
        const existingFavorite = await favoritesRepository.getOne({
            filters: [
                {
                    key: "userId",
                    sign: "=",
                    value: userId
                },
                {
                    key: "cityId",
                    sign: "=",
                    value: cityId
                },
                {
                    key: "listingId",
                    sign: "=",
                    value: listingId
                }
            ]
        });

        if (existingFavorite) {
            return {
                status: "success",
                message: "Favorite already exists",
                id: existingFavorite.id
            };
        }
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(
            err.message ||
                "An error occurred while checking for existing favorite"
        );
    }

    try {
        // return await favoritesRepo.addFavoriteForUser(
        //     paramUserId,
        //     cityId,
        //     listingId,
        // );
        return await favoritesRepository.create({
            data: {
                userId,
                cityId,
                listingId
            }
        });
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const addNewFavoriteCityForUser = async function (userId, cityId) {
    if (!userId) {
        throw new AppError(`You are not allowed to access this resource`, 403);
    }

    if (isNaN(Number(cityId)) || Number(cityId) <= 0) {
        throw new AppError(`Invalid cityId`, 400);
    } else {
        try {
            const response = await citiesrepository.getOne({
                filters: [
                    {
                        key: "id",
                        sign: "=",
                        value: cityId
                    }
                ]
            });
            if (!response) {
                throw new AppError(`Invalid City '${cityId}' given`, 400);
            }
        } catch (err) {
            if (err instanceof AppError) throw err;
            throw new AppError(err);
        }
    }
    // Check if the favorite already exists
    try {
        const existingFavorite = await favoriteCitiesRepository.getOne({
            filters: [
                {
                    key: "userId",
                    sign: "=",
                    value: userId
                },
                {
                    key: "cityId",
                    sign: "=",
                    value: cityId
                }
            ]
        });

        if (existingFavorite) {
            return {
                status: "success",
                message: "Favorite already exists",
                id: existingFavorite.id
            };
        }
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(
            err.message ||
                "An error occurred while checking for existing favorite"
        );
    }

    try {
        return await favoriteCitiesRepository.create({
            data: {
                userId,
                cityId
            }
        });
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const deleteFavoriteListingForUser = async function (
    listingId,
    userId
) {
    if (isNaN(Number(listingId)) || Number(listingId) <= 0) {
        throw new AppError(`Invalid listingId ${listingId}`, 400);
    }
    if (!userId) {
        throw new AppError(`You are not allowed to access this resource`, 403);
    }
    try {
        // const response = await favoritesRepo.getFavoritesWithFilter({
        //     id: favoriteId,
        // });
        const response = await favoritesRepository.getAll({
            filters: [
                {
                    key: "listingId",
                    sign: "=",
                    value: listingId
                },
                {
                    key: "userId",
                    sign: "=",
                    value: userId
                }
            ]
        });
        if (response.length === 0) {
            throw new AppError(
                `Favorites with id ${listingId} does not exist`,
                404
            );
        }
        // await favoritesRepo.deleteFavorite(listingId);
        await favoritesRepository.delete({
            filters: [
                {
                    key: "listingId",
                    sign: "=",
                    value: listingId
                },
                {
                    key: "userId",
                    sign: "=",
                    value: userId
                }
            ]
        });
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const deleteFavoriteCityForUser = async function (cityId, userId) {
    if (isNaN(Number(cityId)) || Number(cityId) <= 0) {
        throw new AppError(`Invalid cityId ${cityId}`, 400);
    }
    if (!userId) {
        throw new AppError(`You are not allowed to access this resource`, 403);
    }
    try {
        const response = await favoriteCitiesRepository.getAll({
            filters: [
                {
                    key: "cityId",
                    sign: "=",
                    value: cityId
                },
                {
                    key: "userId",
                    sign: "=",
                    value: userId
                }
            ]
        });
        if (response.length === 0) {
            throw new AppError(
                `Favorites with id ${cityId} does not exist`,
                404
            );
        }
        // await favoritesRepo.deleteFavorite(cityId);
        await favoriteCitiesRepository.delete({
            filters: [
                {
                    key: "cityId",
                    sign: "=",
                    value: cityId
                },
                {
                    key: "userId",
                    sign: "=",
                    value: userId
                }
            ]
        });
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

module.exports = {
    addNewFavoriteForUser,
    getAllFavoritesForUser,
    getFavoriteListingsForUser,
    getFavoriteCitiesForUser,
    addNewFavoriteCityForUser,
    deleteFavoriteCityForUser,
    deleteFavoriteListingForUser
};
