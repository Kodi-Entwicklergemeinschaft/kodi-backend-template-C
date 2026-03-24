const AppError = require("../utils/appError");
const cityServiceRepository = require("../repository/citiesRepo");
const userFavoriteCitiesRepository = require("../repository/userFavoriteCitiesRepo");
const cityRepository = require("../repository/cityRepo");
const roles = require("../constants/roles");
const userRepository = require("../repository/userRepo");
const imageUpload = require("../utils/imageUpload");
const supportedLanguages = require("../constants/supportedLanguages");
const { translateObjectValues } = require("./translationService");
const cityUserRolesRepository = require("../repository/cityUserRolesRepo");
const cityTypes = require("../constants/cityTypes");

const getCities = async function ({
    hasForum,
    type,
    parentId,
    userId = null,
    pageNo,
    pageSize,
    searchQuery,
    orderBy,
    isDescending
}) {
    try {
        const filters = [];
        if (type) {
            filters.push({
                key: "type",
                sign: "=",
                value: type
            });
        }
        if (searchQuery) {
            filters.push({
                key: "name",
                sign: "LIKE",
                value: `%${searchQuery.trim().replace(/'/g, "''")}%`
            });
        }
        if (hasForum) {
            filters.push({
                key: "hasForum",
                sign: "=",
                value: hasForum,
            });
        }
        if (parentId) {
            filters.push({
                key: "parentId",
                sign: "=",
                value: parentId,
            });
        }
        // return await cityService.getCities(filter);
        const cities = await cityServiceRepository.getAll({
            filters,
            pageNo,
            pageSize,
            orderBy: [orderBy],
            isDescending,
            columns: "id, name, type, image, websiteUrl, parentId, hasForum"
        });
        if (userId !== null) {
            const userFavoriteCitiesResponse =
                await userFavoriteCitiesRepository.getAll({
                    filters: [
                        {
                            key: "userId",
                            sign: "=",
                            value: userId,
                        },
                    ],
                    columns: "cityId",
                });
            const userFavoriteCities = userFavoriteCitiesResponse.rows.map(
                (city) => city.cityId
            );
            cities.rows.forEach((city) => {
                city.isFavorite = false;
                if (userFavoriteCities.includes(city.id)) {
                    city.isFavorite = true;
                }
            });
        } else {
            cities.rows.forEach((city) => {
                city.isFavorite = false;
            });
        }
        return cities.rows;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const getCity = async function (cityId, userId = null, translate) {
    try {
        const city = await cityServiceRepository.getCityById(
            cityId,
            userId,
            translate
        );
        if (!city) {
            throw new AppError("City not found", 404);
        }

        let responseCity = city;

        if (translate && supportedLanguages.includes(translate)) {
            responseCity = await translateObjectValues({ ...responseCity }, translate, ['description', 'subtitle', 'address', 'title']);
        }

        return responseCity;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const updateCity = async (cityId, cityData, userId, imageFile, mayorImage) => {
    if (!userId) throw new AppError("userId not present", 404);

    const user = await getUser(userId);
    if (!user) throw new AppError(`Invalid User '${userId}' given`, 400);

    if (user.roleId === roles.Admin) {
        // Super Admin — allowed to update any city, no further check needed
    } else if (user.roleId === roles.CityAdmin) {
        // City Admin — only allowed if mapped to this specific city
        const mapping = await cityUserRolesRepository.getByCityAndUser(cityId, userId);
        if (!mapping) {
            throw new AppError(`You are not allowed to update this city`, 403);
        }
    } else {
        throw new AppError(`You are not allowed to access this resource`, 403);
    }


    if (!cityId) throw new AppError("cityId not present", 404);

    const currentCityData = await cityRepository.getOne({
        filters: [{ key: "id", value: cityId, sign: "=" }],
    });

    if (!currentCityData) {
        throw new AppError(`City with id = ${cityId} does not exist`, 404);
    }

    const updationData = {};

    // Optional field checks
    if (
        cityData.description &&
        cityData.description !== currentCityData.description
    ) {
        updationData.description = cityData.description;
    }
    if (cityData.subtitle && cityData.subtitle !== currentCityData.subtitle) {
        updationData.subtitle = cityData.subtitle;
    }
    // Map between JavaScript camelCase and database snake_case
    const dbFields = {
        mayorName: 'mayor_name',
        mayorDescription: 'mayor_description'
    };

    if (cityData.mayorName && cityData.mayorName !== currentCityData[dbFields.mayorName]) {
        updationData[dbFields.mayorName] = cityData.mayorName;
    }
    if (cityData.mayorDescription && cityData.mayorDescription !== currentCityData[dbFields.mayorDescription]) {
        updationData[dbFields.mayorDescription] = cityData.mayorDescription;
    }

    // Handle image upload
    if (imageFile && imageFile.data) {
        if (!imageFile.mimetype?.startsWith("image/")) {
            throw new AppError("Invalid image file type", 400);
        }

        // Generate unique filename with original extension
        const fileExtension = imageFile.name.split(".").pop();
        const imagePath = `admin/city/${cityId}/logo.${fileExtension}`;

        try {

            const uploadResult = await imageUpload(imageFile, imagePath);

            if (uploadResult.uploadStatus !== "Success") {
                throw new AppError("Image upload failed", 500);
            }

            updationData.image = uploadResult.objectKey;
        } catch (error) {
            console.error("Image upload error:", error);
            throw new AppError("Failed to upload image", 500);
        }
    }

    if (mayorImage && mayorImage.data) {
        if (!mayorImage.mimetype?.startsWith("image/")) {
            throw new AppError("Invalid image file type", 400);
        }

        // Generate unique filename with original extension
        const fileExtension = mayorImage.name.split(".").pop();
        const imagePath = `admin/city/${cityId}/mayor_image.${fileExtension}`;

        try {
            const uploadResult = await imageUpload(mayorImage, imagePath);

            if (uploadResult.uploadStatus !== "Success") {
                throw new AppError("Image upload failed", 500);
            }

            // Add to dbFields mapping
            dbFields.mayorImage = 'mayor_image';
            updationData[dbFields.mayorImage] = uploadResult.objectKey;
        } catch (error) {
            console.error("Image upload error:", error);
            throw new AppError("Failed to upload image", 500);
        }
    }

    if (Object.keys(updationData).length === 0) {
        return { message: "No changes to update", city: currentCityData };
    }

    updationData.updatedAt = new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

    let transaction;
    try {
        transaction = await cityRepository.createTransaction();

        await cityRepository.updateWithTransaction(
            {
                data: updationData,
                filters: [{ key: "id", sign: "=", value: cityId }],
            },
            transaction
        );

        await cityRepository.commitTransaction(transaction);

        const updatedCity = await cityRepository.getOne({
            filters: [{ key: "id", value: cityId, sign: "=" }],
        });

        return {
            message: "City updated successfully",
            city: updatedCity,
        };
    } catch (err) {
        if (transaction) await cityRepository.rollbackTransaction(transaction);
        throw err instanceof AppError ? err : new AppError(err);
    }
};

async function getUser(userId) {
    try {
        const user = await userRepository.getOne({
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: userId,
                },
            ],
        });
        if (!user) {
            throw new AppError(`Invalid User '${userId}' given`, 400);
        }
        return user;
    } catch (err) {
        if (err instanceof AppError) {
            throw err;
        }
        throw new AppError(err, 500);
    }
}

const assignCityAdmin = async (requestingUserId, cityId, targetUserId) => {
    // Only Super Admin (roleId 1) can assign city admins
    const requestingUser = await getUser(requestingUserId);
    if (requestingUser.roleId !== roles.Admin) {
        throw new AppError("You are not allowed to access this resource", 403);
    }

    // Validate city exists
    const city = await cityRepository.getOne({
        filters: [{ key: "id", sign: "=", value: cityId }],
    });
    if (!city) {
        throw new AppError(`City with id = ${cityId} does not exist`, 404);
    }
    if (city.type !== cityTypes.CITY) {
        throw new AppError(`City with id = ${cityId} is not of type 'city'`, 400);
    }

    // Validate target user exists
    const targetUser = await getUser(targetUserId);

    // Super Admin cannot be assigned as City Admin
    if (targetUser.roleId === roles.Admin) {
        throw new AppError(`User '${targetUser.username || targetUserId}' is a Super Admin and cannot be assigned as City Admin`, 400);
    }

    // Check if already assigned as city admin
    const existingMapping = await cityUserRolesRepository.getByCityAndUser(cityId, targetUserId);
    if (existingMapping) {
        throw new AppError(`User '${targetUser.username || targetUserId}' is already a City Admin for this city`, 400);
    }

    await cityUserRolesRepository.assignAdmin(cityId, targetUserId, 1);

    // Update the user's global roleId to CityAdmin (4)
    await userRepository.update({
        data: { roleId: roles.CityAdmin },
        filters: [{ key: "id", sign: "=", value: targetUserId }],
    });

    return {
        message: `User '${targetUser.username || targetUserId}' has been assigned as City Admin for city '${city.name}'`,
        cityId,
        userId: targetUserId,
        isAdmin: 1,
    };
};

const removeCityAdmin = async (requestingUserId, cityId, targetUserId) => {
    // Only Super Admin (roleId 1) can remove city admins
    const requestingUser = await getUser(requestingUserId);
    if (requestingUser.roleId !== roles.Admin) {
        throw new AppError("You are not allowed to access this resource", 403);
    }

    // Validate city exists
    const city = await cityRepository.getOne({
        filters: [{ key: "id", sign: "=", value: cityId }],
    });
    if (!city) {
        throw new AppError(`City with id = ${cityId} does not exist`, 404);
    }
    if (city.type !== cityTypes.CITY) {
        throw new AppError(`City with id = ${cityId} is not of type 'city'`, 400);
    }

    // Validate target user exists
    const targetUser = await getUser(targetUserId);

    // Check if the mapping exists
    const existingMapping = await cityUserRolesRepository.getByCityAndUser(cityId, targetUserId);
    if (!existingMapping) {
        throw new AppError(`User '${targetUser.username || targetUserId}' is not a City Admin for this city`, 404);
    }

    // Delete the city admin mapping
    await cityUserRolesRepository.deleteAdmin(cityId, targetUserId);

    // Only reset roleId if the user has no remaining city admin assignments
    const remainingMappings = await cityUserRolesRepository.getByUser(targetUserId);
    if (remainingMappings.length === 0) {
        await userRepository.update({
            data: { roleId: roles["Content Creator"] },
            filters: [{ key: "id", sign: "=", value: targetUserId }],
        });
    }

    return {
        message: `User '${targetUser.username || targetUserId}' has been removed as City Admin from city '${city.name}'`,
        cityId,
        userId: targetUserId,
    };
};

const getCityAdmins = async (cityId) => {
    // Validate city exists
    const city = await cityRepository.getOne({
        filters: [{ key: "id", sign: "=", value: cityId }],
    });
    if (!city) {
        throw new AppError(`City with id = ${cityId} does not exist`, 404);
    }
    if (city.type !== cityTypes.CITY) {
        throw new AppError(`City with id = ${cityId} is not of type 'city'`, 400);
    }

    const admins = await cityUserRolesRepository.getByCityWithUserDetails(cityId);
    return admins;
};

const getAdminCities = async (userId, roleId) => {
    if (roleId === roles.Admin) {
        // Super Admin — return all cities
        const result = await cityServiceRepository.getAll({
            columns: "id, name, type, image, websiteUrl, parentId",
            orderBy: ["name"],
        });
        return result.rows;
    }

    if (roleId === roles.CityAdmin) {
        // City Admin — return cities they administer + full ancestor chain
        const cities = await cityUserRolesRepository.getCitiesWithDetailsByUserId(userId);

        const allCities = [...cities];
        const seenIds = new Set(cities.map((c) => c.id));

        // Walk up the ancestor chain until no new parentIds are found
        let pendingParentIds = [...new Set(
            cities
                .map((c) => c.parentId)
                .filter((pid) => pid !== null && pid !== undefined && !seenIds.has(pid))
        )];

        while (pendingParentIds.length > 0) {
            const parentResult = await cityServiceRepository.getAll({
                filters: [{ key: "id", sign: "IN", value: pendingParentIds }],
                columns: "id, name, type, image, websiteUrl, parentId",
            });

            const fetchedCities = parentResult.rows;
            fetchedCities.forEach((c) => {
                seenIds.add(c.id);
                allCities.push(c);
            });

            // Find next level of parentIds not yet seen
            pendingParentIds = [...new Set(
                fetchedCities
                    .map((c) => c.parentId)
                    .filter((pid) => pid !== null && pid !== undefined && !seenIds.has(pid))
            )];
        }

        return allCities;
    }


    // Normal user or any other role — no admin cities
    return [];
};

module.exports = {
    getCities,
    getCity,
    updateCity,
    assignCityAdmin,
    removeCityAdmin,
    getCityAdmins,
    getAdminCities,
};
