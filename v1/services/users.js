const bcrypt = require("bcrypt");
const crypto = require("crypto");
const AppError = require("../utils/appError");
const errorCodes = require("../constants/errorCodes");
const roles = require("../constants/roles");
const sendMail = require("../utils/sendMail");
const getDateInFormate = require("../utils/getDateInFormate");
const supportedSocialMedia = require("../constants/supportedSocialMedia");
const imageUpload = require("../utils/imageUpload");
const objectDelete = require("../utils/imageDelete");
const tokenUtil = require("../utils/token");
const { getUserImages } = require("../repository/image");
const imageDeleteAsync = require("../utils/imageDeleteAsync");

const usersRepository = require("../repository/userRepo");
const interestsRepository = require("../repository/interestsRepo");
const userPreferenceInterestsRepository = require("../repository/userPreferenceInterestsRepo");
const tokenRepository = require("../repository/tokenRepo");
const userCityUserMappingRepository = require("../repository/cityUserMappingRepo");
const verificationTokenRepository = require("../repository/verificationTokensRepo");
const forgotPasswordTokenRepository = require("../repository/forgotPasswordTokensRepo");
const statusRepository = require("../repository/statusRepo");
const listingRepository = require("../repository/listingsRepo");
const categoryRepository = require("../repository/categoriesRepo");
const subCategoryRepository = require("../repository/subcategoriesRepo");
const firebaseTokenRepository = require("../repository/firebaseTokenRepo");
const userPointsRepo = require("../repository/userPointsRepo");
const cityRepo = require("../repository/cityRepo");
const userGamePointsRepo = require("../repository/userGamePointsRepo");
const citiesRepository = require("../repository/citiesRepo");
const userInvitationsRepository = require("../repository/userInvitationsRepo");
const cityUserRolesRepository = require("../repository/cityUserRolesRepo");


const migrateGuestUser = async (userId, guestUserId) => {
    const connection = await usersRepository.createTransaction();
    try {
        // 1. Update the user with guest reference
        await usersRepository.updateWithTransaction(
            {
                data: { guestUserRef: guestUserId },
                filters: [{ key: 'id', sign: '=', value: userId }]
            },
            connection
        );

        // 2. Update exercise_sessions table
        await connection.query(
            'UPDATE user_exercise_sessions SET userId = ? WHERE userId = ?',
            [userId, guestUserId]
        );

        // 3. Update user_activity_logs table
        await connection.query(
            'UPDATE user_activity_log SET userId = ? WHERE userId = ?',
            [userId, guestUserId]
        );

        // 4. Handle user_points migration with unique constraint handling
        // First, get all guest user points
        const [guestPoints] = await connection.query(
            'SELECT * FROM user_points WHERE userId = ?',
            [guestUserId]
        );

        for (const point of guestPoints) {
            // Check if a point entry already exists for this user, equipment and location
            const [existingPoint] = await connection.query(
                'SELECT id, totalPoints FROM user_points WHERE userId = ? AND equipmentId = ? AND locationId = ?',
                [userId, point.equipmentId, point.locationId]
            );

            if (existingPoint && existingPoint.length > 0) {
                // Update existing points by adding guest points
                await connection.query(
                    'UPDATE user_points SET totalPoints = totalPoints + ? WHERE id = ?',
                    [point.totalPoints, existingPoint[0].id]
                );
                // Delete the guest point record
                await connection.query(
                    'DELETE FROM user_points WHERE id = ?',
                    [point.id]
                );
            } else {
                // If no existing point, update the userId to transfer the points
                await connection.query(
                    'UPDATE user_points SET userId = ? WHERE id = ?',
                    [userId, point.id]
                );
            }
        }

        // 5 Migrate user_favorite_cities
        const [guestFavoriteCities] = await connection.query(
            'SELECT id, cityId FROM user_favorite_cities WHERE userId = ?',
            [guestUserId]
        );

        for (const fav of guestFavoriteCities) {
            const [existing] = await connection.query(
                'SELECT id FROM user_favorite_cities WHERE userId = ? AND cityId = ?',
                [userId, fav.cityId]
            );
            if (existing && existing.length > 0) {
                // Target user already has this city as favourite – remove the guest record to avoid duplicates
                await connection.query(
                    'DELETE FROM user_favorite_cities WHERE id = ?',
                    [fav.id]
                );
            } else {
                // Transfer the favourite city to the target user
                await connection.query(
                    'UPDATE user_favorite_cities SET userId = ? WHERE id = ?',
                    [userId, fav.id]
                );
            }
        }

        // 6 Migrate favorites (listing favourites)
        const [guestFavorites] = await connection.query(
            'SELECT id, cityId, listingId FROM favorites WHERE userId = ?',
            [guestUserId]
        );

        for (const fav of guestFavorites) {
            const [existing] = await connection.query(
                'SELECT id FROM favorites WHERE userId = ? AND cityId = ? AND listingId = ?',
                [userId, fav.cityId, fav.listingId]
            );
            if (existing && existing.length > 0) {
                // Duplicate exists – delete the guest record
                await connection.query(
                    'DELETE FROM favorites WHERE id = ?',
                    [fav.id]
                );
            } else {
                // Transfer to the registered user
                await connection.query(
                    'UPDATE favorites SET userId = ? WHERE id = ?',
                    [userId, fav.id]
                );
            }
        }

        // 7 Migrate user_favourite_equipments
        const [guestFavEquipments] = await connection.query(
            'SELECT id, equipmentId, locationId FROM user_favourite_equipments WHERE userId = ?',
            [guestUserId]
        );

        for (const eq of guestFavEquipments) {
            const [existing] = await connection.query(
                'SELECT id FROM user_favourite_equipments WHERE userId = ? AND equipmentId = ? AND locationId = ?',
                [userId, eq.equipmentId, eq.locationId]
            );
            if (existing && existing.length > 0) {
                // Duplicate exists – remove guest record
                await connection.query(
                    'DELETE FROM user_favourite_equipments WHERE id = ?',
                    [eq.id]
                );
            } else {
                // Transfer equipment favourite to the registered user
                await connection.query(
                    'UPDATE user_favourite_equipments SET userId = ? WHERE id = ?',
                    [userId, eq.id]
                );
            }
        }

        // 8. Handle user_game_points migration with unique constraint handling
        const [guestGamePoints] = await connection.query(
            'SELECT * FROM user_game_points WHERE userId = ?',
            [guestUserId]
        );

        for (const gamePoint of guestGamePoints) {
            // Check if a game point entry already exists for this user and game
            const [existingGamePoint] = await connection.query(
                'SELECT id, totalPoints FROM user_game_points WHERE userId = ? AND gameId = ? AND levelId = ?',
                [userId, gamePoint.gameId, gamePoint.levelId]
            );

            if (existingGamePoint && existingGamePoint.length > 0) {
                // Update existing game points by adding guest points
                /* await connection.query(
                    'UPDATE user_game_points SET totalPoints = totalPoints + ? WHERE id = ?',
                    [gamePoint.totalPoints, existingGamePoint[0].id]
                ); */
                // Delete the guest game point record
                await connection.query(
                    'DELETE FROM user_game_points WHERE id = ?',
                    [gamePoint.id]
                );
            } else {
                // If no existing game point, update the userId to transfer the points
                await connection.query(
                    'UPDATE user_game_points SET userId = ? WHERE id = ?',
                    [userId, gamePoint.id]
                );
            }
        }

        // 9. Update exercise_sessions table
        await connection.query(
            'UPDATE user_gaming_sessions SET userId = ? WHERE userId = ?',
            [userId, guestUserId]
        );

        // 10. Migrate user_preference_interests
        const [guestPreferenceInterests] = await connection.query(
            'SELECT id, interestId FROM user_preference_interests WHERE userId = ?',
            [guestUserId]
        );

        for (const pref of guestPreferenceInterests) {
            const [existing] = await connection.query(
                'SELECT id FROM user_preference_interests WHERE userId = ? AND interestId = ?',
                [userId, pref.interestId]
            );
            if (existing && existing.length > 0) {
                // Target user already has this interest – remove the guest record to avoid duplicates
                await connection.query(
                    'DELETE FROM user_preference_interests WHERE id = ?',
                    [pref.id]
                );
            } else {
                // Transfer interest preference to the registered user
                await connection.query(
                    'UPDATE user_preference_interests SET userId = ? WHERE id = ?',
                    [userId, pref.id]
                );
            }
        }

        // 11. Migrate user demographics data
        const [guestUserData] = await connection.query(
            'SELECT accommodationPreference, cityId, maritalStatus, isOnBoarded, userType FROM users WHERE id = ?',
            [guestUserId]
        );

        const [targetUserData] = await connection.query(
            'SELECT accommodationPreference, cityId, maritalStatus, isOnBoarded, userType FROM users WHERE id = ?',
            [userId]
        );

        if (guestUserData?.[0] && targetUserData?.[0]) {
            const guest = guestUserData[0];
            const target = targetUserData[0];
            const fieldsToMigrate = ['accommodationPreference', 'cityId', 'maritalStatus', 'isOnBoarded', 'userType'];

            const { updates, values } = fieldsToMigrate.reduce((acc, field) => {
                if (guest[field] !== null && (target[field] === null || target[field] === undefined)) {
                    acc.updates.push(`${field} = ?`);
                    acc.values.push(guest[field]);
                }
                return acc;
            }, { updates: [], values: [] });

            if (updates.length > 0) {
                // Update target user with guest's data
                const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
                await connection.query(updateQuery, [...values, userId]);

                // Clear the migrated fields from guest user
                const clearFields = fieldsToMigrate.map(field => `${field} = NULL`).join(', ');
                const clearQuery = `UPDATE users SET ${clearFields} WHERE id = ?`;
                await connection.query(clearQuery, [guestUserId]);
            }
        }

        // 12. Mark guest user as deleted
        await usersRepository.updateWithTransaction(
            {
                data: { isDeleted: 1 },
                filters: [{ key: 'id', sign: '=', value: guestUserId }]
            },
            connection
        );

        await usersRepository.commitTransaction(connection);
    } catch (error) {
        await usersRepository.rollbackTransaction(connection);
        throw new AppError(
            error.message || 'Error migrating guest user',
            error.statusCode || 500
        );
    }
};
const createGuestUser = async (userData) => {
    try {
        const existingUser = await usersRepository.getOne({
            filters: [{
                key: 'username',
                sign: '=',
                value: userData.username
            }]
        });

        if (existingUser) {
            return existingUser;
        }

        const result = await usersRepository.create({ data: userData });
        const { password, ...userWithoutPassword } = result;
        return userWithoutPassword
    } catch (error) {
        throw new AppError(
            error.message || 'Error creating guest user',
            error.statusCode || 500
        );
    }
};

const findGuestUserByDeviceId = async (deviceId) => {
    try {
        const user = await usersRepository.getOne({
            filters: [
                {
                    key: 'username',
                    sign: '=',
                    value: deviceId
                }
            ]
        });

        if (!user) {
            return null;
        }

        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
    } catch (error) {
        throw new AppError(
            error.message || 'Error finding guest user',
            error.statusCode || 500
        );
    }
};

const login = async function (payload, sourceAddress, browsername, devicetype) {
    try {
        const userData = await usersRepository.getOne({
            filters: [
                {
                    key: "username",
                    sign: "=",
                    value: payload.username
                },
                {
                    key: "email",
                    sign: "=",
                    value: payload.username
                }
            ],
            joinFiltersBy: "OR",
            columns: [
                "id",
                "username",
                "email",
                "password",
                "emailVerified",
                "roleId",
                "isOnBoarded"
            ]
        });

        if (!userData) {
            throw new AppError(
                `Invalid username or email`,
                401,
                errorCodes.INVALID_CREDENTIALS
            );
        }

        if (!userData.emailVerified) {
            throw new AppError(
                `Verification email sent to your email id. Please verify first before trying to login.`,
                401,
                errorCodes.EMAIL_NOT_VERIFIED
            );
        }

        const correctPassword = await bcrypt.compare(
            payload.password,
            userData.password
        );
        if (!correctPassword) {
            throw new AppError(
                `Invalid password`,
                401,
                errorCodes.INVALID_PASSWORD
            );
        }

        // const userMappings = await userRepo.getuserCityMappings(userData.id);
        let userMappings = [];
        const userMappingsResp = await userCityUserMappingRepository.getAll({
            filters: [
                {
                    key: "userId",
                    sign: "=",
                    value: userData.id
                }
            ],
            columns: ["cityId", "cityUserId"]
        });
        if (
            !userMappingsResp ||
            !userMappingsResp.rows ||
            userMappingsResp.rows.length === 0
        ) {
            userMappings = [];
        } else {
            userMappings = userMappings.rows;
        }

        const tokens = tokenUtil.generator({
            userId: userData.id,
            roleId: userData.roleId,
            rememberMe: payload.rememberMe
        });

        const refreshToken = await tokenRepository.getOne({
            filters: [
                {
                    key: "userId",
                    sign: "=",
                    value: userData.id
                }
            ]
        });
        if (
            refreshToken &&
            refreshToken.sourceAddress === sourceAddress &&
            (refreshToken.browser === browsername ||
                (!refreshToken.browser && !browsername)) &&
            (refreshToken.device === devicetype ||
                (!refreshToken.device && !devicetype))
        ) {
            tokenRepository.delete({
                filters: [
                    {
                        key: "id",
                        sign: "=",
                        value: refreshToken.id
                    }
                ]
            });
        }
        const insertionData = {
            userId: userData.id,
            sourceAddress,
            refreshToken: tokens.refreshToken,
            browser: browsername,
            device: devicetype
        };

        await tokenRepository.create({
            data: insertionData
        });
        return {
            cityUsers: userMappings ?? [],
            userId: userData.id,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            isOnBoarded: userData.isOnBoarded === 1
        };
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err, 500);
    }
};

const register = async function (payload) {
    const insertionData = {};
    if (!payload) {
        throw new AppError(`Empty payload sent`, 400, errorCodes.EMPTY_PAYLOAD);
    }
    const language = payload.language || "de";
    if (language !== "en" && language !== "de") {
        throw new AppError(
            `Incorrect language given`,
            400,
            errorCodes.INVALID_LANGUAGE
        );
    }

    if (!payload.username) {
        throw new AppError(
            `Username is not present`,
            400,
            errorCodes.MISSING_USERNAME
        );
    } else {
        const normalizedUsername = payload.username.trim().toLowerCase();
        if (normalizedUsername.length < 4 || normalizedUsername.length > 20) {
            throw new AppError(
                `Username must be between 4 and 20 characters`,
                400,
                errorCodes.INVALID_USERNAME
            );
        }
        try {
            // const user = await userRepo.getUserWithUsername(payload.username);
            const user = await usersRepository.getOne({
                filters: [
                    {
                        key: "username",
                        sign: "=",
                        value: normalizedUsername
                    }
                ]
            });
            if (user) {
                throw new AppError(
                    `User with username '${normalizedUsername}' already exists`,
                    400,
                    errorCodes.USER_ALREADY_EXISTS
                );
            }

            if (
                /\s/.test(normalizedUsername) ||
                /^_/.test(normalizedUsername)
            ) {
                throw new AppError(
                    `Username '${normalizedUsername}' is not valid as it contains spaces or underscore.`,
                    400,
                    errorCodes.INVALID_USERNAME,
                );
            }
            if (/^[^a-z_]/.test(normalizedUsername)) {
                throw new AppError(
                    `Username '${normalizedUsername}' is not valid as it starts with captial letter.`,
                    400,
                    errorCodes.INVALID_USERNAME
                );
            }
        } catch (err) {
            if (err instanceof AppError) throw err;
            throw new AppError(err);
        }
        insertionData.username = normalizedUsername;
    }

    if (!payload.email) {
        throw new AppError(
            `Email is not present`,
            400,
            errorCodes.MISSING_EMAIL
        );
    } else {
        const re = /^[a-z0-9]+(\.[a-z0-9]+)*@[a-z0-9.-]+\.[a-z]{2,}$/i;
        if (!re.test(payload.email)) {
            throw new AppError(
                `Invalid email given`,
                400
            );
        }
        try {
            // const user = await userRepo.getUserWithEmail(payload.email);
            const user = await usersRepository.getOne({
                filters: [
                    {
                        key: "email",
                        sign: "=",
                        value: payload.email
                    }
                ]
            });
            if (user) {
                throw new AppError(
                    `User with email '${payload.email}' is already registered`,
                    400,
                    errorCodes.EMAIL_ALREADY_EXISTS
                );
            }
        } catch (err) {
            if (err instanceof AppError) throw err;
            throw new AppError(err);
        }
        insertionData.email = payload.email;
    }

    insertionData.roleId = roles["Content Creator"];

    if (!payload.firstname) {
        throw new AppError(
            `Firstname is not present`,
            400,
            errorCodes.MISSING_FIRSTNAME
        );
    } else {
        if (payload.firstname.length > 40) {
            throw new AppError(
                `Firstname too long. Maximum 40 characters allowed`,
                400,
                errorCodes.INVALID_CREDENTIALS
            );
        }
        insertionData.firstname = payload.firstname;
    }

    if (!payload.lastname) {
        throw new AppError(
            `Lastname is not present`,
            400,
            errorCodes.MISSING_LASTNAME
        );
    } else {
        if (payload.lastname.length > 40) {
            throw new AppError(
                `Lastname too long. Maximum 40 characters allowed`,
                400,
                errorCodes.INVALID_CREDENTIALS
            );
        }
        insertionData.lastname = payload.lastname;
    }

    if (!payload.password) {
        throw new AppError(
            `Password is not present`,
            400,
            errorCodes.MISSING_PASSWORD
        );
    } else {
        if (payload.password.length > 16) {
            throw new AppError(
                `Password too long. Maximum 16 characters allowed.`,
                400,
                errorCodes.INVALID_PASSWORD
            );
        }
        const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?#&^])[A-Za-z\d@$!%*?#&^]{8,16}$/;
        if (!re.test(payload.password)) {
            throw new AppError(
                `Invalid Password. `,
                400,
                errorCodes.INVALID_PASSWORD
            );
        } else {
            insertionData.password = await bcrypt.hash(
                payload.password,
                Number(process.env.SALT)
            );
        }
    }

    if (payload.email) {
        insertionData.email = payload.email;
    }

    if (payload.phoneNumber) {
        const re = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
        if (!re.test(payload.phoneNumber))
            throw new AppError("Phone number is not valid");
        insertionData.website = payload.website;
    }

    if (payload.description) {
        if (payload.description.length > 255) {
            throw new AppError(
                `Length of Description cannot exceed 255 characters`,
                400
            );
        }
        insertionData.description = payload.description;
    }

    if (payload.website) {
        insertionData.website = payload.website;
    }

    if (payload.socialMedia) {
        try {
            const socialMediaList = payload.socialMedia;
            Object.keys(socialMediaList).forEach((socialMedia) => {
                if (!supportedSocialMedia.includes(socialMedia)) {
                    throw new AppError(
                        `Unsupported social media '${socialMedia}'`,
                        400
                    );
                }

                if (
                    typeof socialMediaList[socialMedia] !== "string" ||
                    !socialMediaList[socialMedia].includes(
                        socialMedia.toLowerCase()
                    )
                ) {
                    throw new AppError(
                        `Invalid input given for social media '${socialMedia}' `,
                        400
                    );
                }
            });
            insertionData.socialMedia = JSON.stringify(socialMediaList);
        } catch (err) {
            if (err instanceof AppError) throw err;
            throw new AppError(`Invalid input given for social media`, 400);
        }
    }

    // const connection = await database.createTransaction();
    const connection = await usersRepository.createTransaction();
    try {
        // const response = await userRepo.createUser(insertionData, connection);
        const response = await usersRepository.create({
            data: insertionData
        });

        const userId = response.id;
        const now = new Date();
        now.setHours(now.getHours() + 24);
        const token = crypto.randomBytes(32).toString("hex");
        const tokenData = {
            userId,
            token,
            expiresAt: getDateInFormate(now)
        };
        await verificationTokenRepository.createWithTransaction(
            {
                data: tokenData
            },
            connection
        );

        const verifyEmail = require(`../emailTemplates/${language}/verifyEmail`);
        const { subject, body } = verifyEmail(
            insertionData.firstname,
            insertionData.lastname,
            token,
            userId,
            language
        );
        await sendMail(insertionData.email, subject, null, body);

        // database.commitTransaction(connection);
        await usersRepository.commitTransaction(connection);

        // Check if this email was invited — auto-assign role and city mapping if so

        try {
            const invitation = await userInvitationsRepository.getByEmail(insertionData.email);
            if (invitation) {
                // Override the default roleId with the invited role
                await usersRepository.update({
                    data: { roleId: invitation.roleId },
                    filters: [{ key: "id", sign: "=", value: userId }],
                });

                // If invited as CityAdmin, create a city_user_roles row for each cityId
                if (invitation.roleId === roles.CityAdmin && invitation.cityIds && invitation.cityIds.length > 0) {
                    for (const cId of invitation.cityIds) {
                        await cityUserRolesRepository.assignAdmin(cId, userId, 1);
                    }
                }

                // Mark invitation as consumed
                await userInvitationsRepository.markUsed(invitation.id);
            }
        } catch (err) {
            console.error("Error processing user invitation:", err);
        }

        return userId;
    } catch (err) {
        if (err instanceof AppError) throw err;
        // database.rollbackTransaction(connection);
        await usersRepository.rollbackTransaction(connection);
        throw new AppError(err);
    }
};

const getUserById = async function (cityUser, cityId, reqUserId) {
    try {
        // const userData = await userRepo.getUserWithId(userId);
        const userData = await usersRepository.getOne({
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: reqUserId
                }
            ],
            columns:
                "id, username, socialMedia, email, website, description, image, phoneNumber, firstname, lastname, roleId, cityid, address"
        });
        if (!userData) {
            throw new AppError(`User does not exist`, 404);
        }
        if (userData?.cityid) {
            const cityId = await cityRepo.getOne({
                filters: [{
                    key: "id",
                    sign: "=",
                    value: userData?.cityid,
                }],
                columns: "id, name"

            })
            delete userData.cityid
            userData.place = cityId
        }

        const userInterests = await userPreferenceInterestsRepository.getInterestsByUserId(userData?.id)
        userData.interests = userInterests ?? []

        return userData;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const updateUser = async function (id, payload) {
    const updationData = {};

    if (payload.allowIdentityUpdate) {
        updationData.emailVerified = 0;
        updationData.allNotificationsEnabled = 0;
        updationData.isOnboarded = 0;

        // Validate and normalize username (guest migration path)
        const normalizedUsername = (payload.username || "").trim().toLowerCase();
        if (!normalizedUsername || normalizedUsername.length < 4 || normalizedUsername.length > 20) {
            throw new AppError(
                `Username must be between 4 and 20 characters`,
                400,
                errorCodes.INVALID_USERNAME
            );
        }
        if (/\s/.test(normalizedUsername) || /^_/.test(normalizedUsername)) {
            throw new AppError(
                `Username '${normalizedUsername}' is not valid as it contains spaces or underscore.`,
                400,
                errorCodes.INVALID_USERNAME
            );
        }
        if (/^[^a-z_]/.test(normalizedUsername)) {
            throw new AppError(
                `Username '${normalizedUsername}' is not valid as it starts with captial letter.`,
                400,
                errorCodes.INVALID_USERNAME
            );
        }
        const existingByUsername = await usersRepository.getOne({
            filters: [
                {
                    key: "username",
                    sign: "=",
                    value: normalizedUsername
                }
            ]
        });
        if (existingByUsername && existingByUsername.id !== id) {
            throw new AppError(
                `User with username '${normalizedUsername}' already exists`,
                400,
                errorCodes.USER_ALREADY_EXISTS
            );
        }
        updationData.username = normalizedUsername;

        // Allow updating email during guest migration
        if (payload.email) {
            const emailRe = /^[a-z0-9]+(\.[a-z0-9]+)*@[a-z0-9.-]+\.[a-z]{2,}$/i;
            if (!emailRe.test(payload.email)) {
                throw new AppError(`Invalid email given`, 400);
            }
            const existingByEmail = await usersRepository.getOne({
                filters: [
                    { key: "email", sign: "=", value: payload.email }
                ]
            });
            if (existingByEmail && existingByEmail.id !== id) {
                throw new AppError(
                    `User with email '${payload.email}' is already registered`,
                    400,
                    errorCodes.EMAIL_ALREADY_EXISTS
                );
            }
            updationData.email = payload.email;
        }

        // Require and validate password for guest migration
        if (!payload.password) {
            throw new AppError(
                `Password is not present`,
                400,
                errorCodes.MISSING_PASSWORD
            );
        }
        if (/\s/.test(payload.password)) {
            throw new AppError(
                `Password cannot contain spaces`,
                400,
                errorCodes.INVALID_PASSWORD
            );
        }
        if (payload.password.length < 8 || payload.password.length > 16) {
            throw new AppError(
                `Password must be between 8 and 16 characters`,
                400,
                errorCodes.INVALID_PASSWORD
            );
        }
        const guestPwdRe = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?#&^])[A-Za-z\d@$!%*?#&^]{8,16}$/;
        if (!guestPwdRe.test(payload.password)) {
            throw new AppError(
                `Invalid Password. `,
                400,
                errorCodes.INVALID_PASSWORD
            );
        }
        updationData.password = await bcrypt.hash(
            payload.password,
            Number(process.env.SALT)
        );
    }
    const currentUserData = await usersRepository.getOne({
        filters: [
            {
                key: "id",
                sign: "=",
                value: id
            }
        ]
    });
    if (!currentUserData) {
        throw new AppError(`User with id ${id} does not exist`, 404);
    }

    if (payload.username && payload.username !== currentUserData.username && !payload.allowIdentityUpdate) {
        throw new AppError(`Username cannot be edited`, 400);
    }

    if (payload.email && payload.email !== currentUserData.email) {
        if (!payload.allowIdentityUpdate) {
            throw new AppError(`Email cannot be edited`, 400);
        }
    }

    if (payload.firstname) {
        if (payload.firstname.length > 40) {
            throw new AppError(
                `Firstname too long. Maximum 40 characters allowed`,
                400,
                errorCodes.INVALID_CREDENTIALS
            );
        }
        updationData.firstname = payload.firstname;
    }

    if (payload.newPassword) {
        if (!payload.currentPassword) {
            throw new AppError(
                `Current password not given to update password`,
                400
            );
        }
        const currentPasswordCorrect = await bcrypt.compare(
            payload.currentPassword,
            currentUserData.password
        );
        if (!currentPasswordCorrect) {
            throw new AppError(
                `Incorrect current password given`,
                401,
                errorCodes.INVALID_PASSWORD
            );
        }
        const passwordCheck = await bcrypt.compare(
            payload.newPassword,
            currentUserData.password
        );
        if (passwordCheck) {
            throw new AppError(
                `New password should not be same as the old password`,
                400,
                errorCodes.SAME_PASSWORD_GIVEN
            );
        }
        // Disallow whitespace and enforce length 8-16
        if (/\s/.test(payload.newPassword)) {
            throw new AppError(
                `Password cannot contain spaces`,
                400,
                errorCodes.INVALID_PASSWORD
            );
        }
        if (payload.newPassword.length < 8 || payload.newPassword.length > 16) {
            throw new AppError(
                `Password must be between 8 and 16 characters`,
                400,
                errorCodes.INVALID_PASSWORD
            );
        }
        const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?#&^])[A-Za-z\d@$!%*?#&^]{8,16}$/;
        if (!re.test(payload.newPassword)) {
            throw new AppError(
                `Invalid Password. `,
                400,
                errorCodes.INVALID_PASSWORD
            );
        }
        updationData.password = await bcrypt.hash(
            payload.newPassword,
            Number(process.env.SALT)
        );
    }

    if (payload.lastname !== null && payload.lastname !== undefined) {
        if (payload.lastname && payload.lastname.length > 40) {
            throw new AppError(
                `Lastname too long. Maximum 40 characters allowed`,
                400,
                errorCodes.INVALID_CREDENTIALS
            );
        }
        updationData.lastname = payload.lastname;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "phoneNumber")) {
        const re = /^(\d{8,15})$/;
        if (payload.phoneNumber !== "" && !re.test(payload.phoneNumber)) {
            throw new AppError("Phone number is not valid", 400);
        }
        // If phoneNumber is an empty string, set it to null
        updationData.phoneNumber =
            payload.phoneNumber === "" ? null : payload.phoneNumber;
    }

    if (payload.description) {
        if (payload.description.length > 255) {
            throw new AppError(
                `Length of Description cannot exceed 255 characters`,
                400
            );
        }

        updationData.description = payload.description;
    }

    if (payload.website) {
        updationData.website = payload.website;
    }

    if (payload.image || payload.image === "") {
        updationData.image = payload.image;
    }

    if (payload.description) {
        updationData.description = payload.description;
    }

    if (payload.website) {
        updationData.website = payload.website;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "address")) {
        updationData.address = payload.address === "" ? null : payload.address;
    }

    if (payload.socialMedia) {
        const socialMediaList = JSON.parse(payload.socialMedia);
        socialMediaList.forEach((socialMedia) => {
            if (!supportedSocialMedia.includes(Object.keys(socialMedia)[0])) {
                throw new AppError(
                    `Unsupported social media '${socialMedia}'`,
                    400
                );
            }

            if (
                typeof socialMedia[Object.keys(socialMedia)[0]] !== "string" ||
                !socialMedia[Object.keys(socialMedia)[0]].includes(
                    Object.values(socialMedia)[0].toLowerCase()
                )
            ) {
                throw new AppError(
                    `Invalid input given for social '${socialMedia}' `,
                    400
                );
            }
        });
        updationData.socialMedia = JSON.stringify(socialMediaList);
    }

    if (Object.keys(updationData).length > 0) {
        // TODO add transaction
        try {
            // const cityUserResponse = await userRepo.getuserCityMappings(id);
            const cityUserResponse = await userCityUserMappingRepository.getAll(
                {
                    filters: [
                        {
                            key: "userId",
                            sign: "=",
                            value: id
                        }
                    ],
                    columns: ["cityId", "cityUserId"]
                }
            );
            // await userRepo.updateUserById(id, updationData);
            await usersRepository.update({
                data: updationData,
                filters: [
                    {
                        key: "id",
                        sign: "=",
                        value: id
                    }
                ]
            });

            const cityUserUpdationData = { ...updationData, coreuserId: id };
            delete cityUserUpdationData.password;
            delete cityUserUpdationData.socialMedia;

            for (const element of cityUserResponse.rows) {
                // await userRepo.updateCityUserById(
                //     element.cityUserId,
                //     cityUserUpdationData,
                //     element.cityId,
                // );
                await usersRepository.update({
                    data: cityUserUpdationData,
                    cityId: element.cityId,
                    filters: [
                        {
                            key: "id",
                            sign: "=",
                            value: element.cityUserId
                        }
                    ]
                });
            }
        } catch (err) {
            if (err instanceof AppError) throw err;
            throw new AppError(err);
        }
    }
};

const refreshAuthToken = async function (sourceAddress, refreshToken) {
    try {
        if (!refreshToken) {
            throw new AppError(`Refresh token not present`, 400);
        }

        const decodedToken = tokenUtil.verify(
            refreshToken,
            process.env.REFRESH_PUBLIC
        );

        const userId = decodedToken.userId

        // const refreshTokenData =
        //     await tokenRepo.getRefreshTokenByRefreshToken(refreshToken);
        const refreshTokenData = await tokenRepository.getOne({
            filters: [
                {
                    key: "refreshToken",
                    sign: "=",
                    value: refreshToken
                }
            ]
        });
        if (!refreshTokenData) {
            throw new AppError(`Invalid refresh token`, 400);
        }

        if (refreshTokenData.userId !== parseInt(userId)) {
            throw new AppError(`Invalid refresh token`, 400);
        }
        const newTokens = tokenUtil.generator({
            userId: decodedToken.userId,
            roleId: decodedToken.roleId
        });
        const insertionData = {
            userId,
            sourceAddress,
            refreshToken: newTokens.refreshToken
        };

        // await tokenRepo.deleteRefreshTokenByTokenUid(refreshTokenData.id);
        await tokenRepository.delete({
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: refreshTokenData.id
                }
            ]
        });

        // await tokenRepo.insertRefreshTokenData(insertionData);
        await tokenRepository.create({
            data: insertionData
        });

        return {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken
        };
    } catch (err) {
        if (err.name === "TokenExpiredError") {
            // await tokenRepo.deleteRefreshTokenByRefreshToken(refreshToken);
            await tokenRepository.delete({
                filters: [
                    {
                        key: "refreshToken",
                        sign: "=",
                        value: refreshToken
                    }
                ]
            });
            throw new AppError(`Unauthorized! Refresh Token was expired!`, 401);
        }
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const forgotPassword = async function (username, language = "de") {
    // const transaction = await database.createTransaction();
    const transaction = await usersRepository.createTransaction();
    try {
        // const user = await userRepo.getUserByUsernameOrEmail(username, username);
        const user = await usersRepository.getOne({
            filters: [
                {
                    key: "username",
                    sign: "=",
                    value: username
                },
                {
                    key: "email",
                    sign: "=",
                    value: username
                }
            ],
            joinFiltersBy: "OR"
        });
        if (!user) {
            const isEmail = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(username);
            const label = isEmail ? "Email" : "Username";
            throw new AppError(`${label} ${username} does not exist`, 404);
        }

        // await userRepo.deleteForgotTokenForUserWithConnection(user.id, transaction);
        await forgotPasswordTokenRepository.deleteWithTransaction(
            {
                filters: [
                    {
                        key: "userId",
                        sign: "=",
                        value: user.id
                    }
                ]
            },
            transaction
        );

        const now = new Date();
        now.setMinutes(now.getMinutes() + 30);
        const token = crypto.randomBytes(32).toString("hex");
        const tokenData = {
            userId: user.id,
            token,
            expiresAt: getDateInFormate(now)
        };

        // await userRepo.addForgotPasswordTokenWithConnection(tokenData, transaction);
        await forgotPasswordTokenRepository.createWithTransaction(
            {
                data: tokenData
            },
            transaction
        );

        const resetPasswordEmail = require(`../emailTemplates/${language}/resetPasswordEmail`);
        const { subject, body } = resetPasswordEmail(
            user.firstname,
            user.lastname,
            token,
            user.id
        );
        await sendMail(user.email, subject, null, body);

        await usersRepository.commitTransaction(transaction);
    } catch (err) {
        await usersRepository.rollbackTransaction(transaction);
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

// TODO: implement transaction
const resetPassword = async function (userId, language, token, password) {
    try {
        // const user = await userRepo.getUserDataById(userId);
        const user = await usersRepository.getOne({
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: userId
                }
            ]
        });
        if (!user) {
            throw new AppError(`UserId ${userId} does not exist`, 400);
        }

        const passwordCheck = await bcrypt.compare(password, user.password);
        if (passwordCheck) {
            throw new AppError(
                `New password should not be same as the old password`,
                400,
                errorCodes.NEW_OLD_PASSWORD_DIFFERENT
            );
        }
        // const tokenData = await tokenRepo.getForgotPasswordToken(userId, token);
        const tokenData = await forgotPasswordTokenRepository.getOne({
            filters: [
                {
                    key: "userId",
                    sign: "=",
                    value: userId
                },
                {
                    key: "token",
                    sign: "=",
                    value: token
                }
            ]
        });
        if (!tokenData) {
            throw new AppError(`Invalid token sent`, 400);
        }
        // await tokenRepo.deleteForgotPasswordToken(userId, token);
        await forgotPasswordTokenRepository.delete({
            filters: [
                {
                    key: "userId",
                    sign: "=",
                    value: userId
                },
                {
                    key: "token",
                    sign: "=",
                    value: token
                }
            ]
        });

        if (tokenData.expiresAt < new Date().toLocaleString()) {
            throw new AppError(`Token Expired`, 400);
        }

        const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?#&^])[A-Za-z\d@$!%*?#&^]{8,}$/;
        if (!re.test(password)) {
            throw new AppError(
                `Invalid Password. `,
                400,
                errorCodes.INVALID_PASSWORD
            );
        }

        const hashedPassword = await bcrypt.hash(
            password,
            Number(process.env.SALT)
        );

        // await userRepo.updateUserById(userId, { password: hashedPassword });
        await usersRepository.update({
            data: {
                password: hashedPassword
            },
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: userId
                }
            ]
        });

        const passwordResetDone = require(`../emailTemplates/${language}/passwordResetDone`);
        const { subject, body } = passwordResetDone(
            user.firstname,
            user.lastname
        );
        await sendMail(user.email, subject, null, body);
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const sendVerificationEmail = async function (email, language = "de") {
    try {
        // const user = await userRepo.getUserWithEmail(email);
        const user = await usersRepository.getOne({
            filters: [
                {
                    key: "email",
                    sign: "=",
                    value: email
                }
            ]
        });
        if (!user) {
            throw new AppError(`Email ${email} does not exist`, 400);
        }
        if (user.emailVerified) {
            throw new AppError(`Email already verified`, 400);
        }

        // await tokenRepo.deleteVerificationToken({ userId: user.id });
        await verificationTokenRepository.delete({
            filters: [
                {
                    key: "userId",
                    sign: "=",
                    value: user.id
                }
            ]
        });

        const now = new Date();
        now.setHours(now.getHours() + 24);
        const token = crypto.randomBytes(32).toString("hex");
        const tokenData = {
            userId: user.id,
            token,
            expiresAt: getDateInFormate(now)
        };
        // TODO: implement transaction
        // await tokenRepo.insertVerificationTokenData(tokenData);
        await verificationTokenRepository.create({
            data: tokenData
        });

        const verifyEmail = require(`../emailTemplates/${language}/verifyEmail`);
        const { subject, body } = verifyEmail(
            user.firstname,
            user.lastname,
            token,
            user.id,
            language
        );
        await sendMail(user.email, subject, null, body);
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const verifyEmail = async function (userId, token, language = "de") {
    try {
        // const user = await userRepo.getUserDataById(userId);
        const user = await usersRepository.getOne({
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: userId
                }
            ]
        });
        if (!user) {
            throw new AppError(`UserId ${userId} does not exist`, 400);
        }
        if (user.emailVerified) {
            return "Email has already been vefified!!";
        }

        // const tokenData = await tokenRepo.getEmailVerificationToken(userId, token);
        const tokenData = await verificationTokenRepository.getOne({
            filters: [
                {
                    key: "userId",
                    sign: "=",
                    value: userId
                },
                {
                    key: "token",
                    sign: "=",
                    value: token
                }
            ]
        });
        if (!tokenData) {
            throw new AppError(`Invalid data sent`, 400);
        }

        // await tokenRepo.deleteVerificationToken({ userId, token });
        await verificationTokenRepository.delete({
            filters: [
                {
                    key: "userId",
                    sign: "=",
                    value: userId
                },
                {
                    key: "token",
                    sign: "=",
                    value: token
                }
            ]
        });

        if (tokenData.expiresAt < new Date().toLocaleString()) {
            throw new AppError(
                `Token Expired, send verification mail again`,
                400
            );
        }

        // await userRepo.updateUserById(userId, { emailVerified: true });
        await usersRepository.update({
            data: {
                emailVerified: true
            },
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: userId
                }
            ]
        });

        const verificationDone = require(`../emailTemplates/${language}/verificationDone`);
        const { subject, body } = verificationDone(
            user.firstname,
            user.lastname
        );
        await sendMail(user.email, subject, null, body);
        return "The Email Verification was successfull!";
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const logout = async function (userId, refreshToken) {
    try {
        // const token = await tokenRepo.getRefreshTokenByRefreshToken(refreshToken);
        const token = await tokenRepository.getOne({
            filters: [
                {
                    key: "refreshToken",
                    sign: "=",
                    value: refreshToken
                }
            ]
        });
        if (!token) {
            throw new AppError(
                `User with id ${refreshToken} does not exist`,
                404
            );
        }
        // await tokenRepo.deleteRefreshTokenFor({ refreshToken, userId });
        await tokenRepository.delete({
            filters: [
                {
                    key: "refreshToken",
                    sign: "=",
                    value: refreshToken
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

const getUsers = async function (userIds, username, reqUserId) {
    const columsToQuery = [
        "id",
        "username",
        "socialMedia",
        "email",
        "website",
        "image",
        "firstname",
        "phoneNumber",
        "lastname",
        "description",
        "roleId"
    ];
    const filter = [];
    if (userIds) {
        filter.push({
            key: "id",
            sign: "IN",
            value: userIds
        });
    }
    if (username) {
        filter.push({
            key: "username",
            sign: "=",
            value: username
        });
    }
    if (!filter) {
        throw new AppError("You need to send some params to filter");
    }
    filter.push({
        key: "roleId",
        sign: "!=",
        value: 4
    });
    try {
        // const users = await userRepo.getAllUsers(filter, columsToQuery);
        const userrResp = await usersRepository.getAll({
            filters: filter,
            columns: columsToQuery
        });
        const users = userrResp.rows;
        users.forEach((user) => {
            if (user.id !== reqUserId) {
                user.email = "***@***.**";
                user.socialMedia = "Hidden";
                user.website = "Hidden";
                user.description = "Hidden";
                user.firstname = "Hidden";
                user.lastname = "Hidden";
            }
        });
        return users;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const listLoginDevices = async function (userId, refreshToken) {
    try {
        // const tokens = await tokenRepo.fetchRefreshTokensOtherThan(
        //     userId,
        //     refreshToken,
        // );
        // if refresh token is not an array, convert it to an array
        if (!Array.isArray(refreshToken)) {
            refreshToken = [refreshToken];
        }
        const tokens = await tokenRepository.getAll({
            filters: [
                {
                    key: "userId",
                    sign: "=",
                    value: userId
                },
                {
                    key: "refreshToken",
                    sign: "NOT IN",
                    value: refreshToken
                }
            ]
        });
        return tokens;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const deleteLoginDevices = async function (paramId, queryId) {
    try {
        if (!queryId) {
            // await tokenRepo.deleteRefreshToken(paramId);
            await tokenRepository.delete({
                filters: [
                    {
                        key: "userId",
                        sign: "=",
                        value: paramId
                    }
                ]
            });
        } else {
            // await tokenRepo.deleteRefreshTokenFor({ paramId, id: queryId });
            await tokenRepository.delete({
                filters: [
                    {
                        key: "userId",
                        sign: "=",
                        value: paramId
                    },
                    {
                        key: "id",
                        sign: "=",
                        value: queryId
                    }
                ]
            });
        }
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const uploadUserProfileImage = async function (id, image) {
    try {
        const imagePath = `user_${id}/profilePic_${Date.now()}`;

        const { uploadStatus } = await imageUpload(image, imagePath);
        if (uploadStatus === "Success") {
            const updationData = {};
            updationData.image = imagePath;
            // await userRepo.updateUserById(id, updationData);
            await usersRepository.update({
                data: updationData,
                filters: [
                    {
                        key: "id",
                        sign: "=",
                        value: id
                    }
                ]
            });
            return updationData;
        }
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const deleteUserProfileImage = async function (userId) {
    try {
        // const user = await userRepo.getUserDataById(userId);
        const user = await usersRepository.getOne({
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: userId
                }
            ]
        });
        if (!user) {
            throw new AppError(`User ${userId} does not exist`, 404);
        }

        const onSuccess = async () => {
            const updationData = {};
            updationData.image = "";

            // await userRepo.updateUserById(userId, updationData);
            await usersRepository.update({
                data: updationData,
                filters: [
                    {
                        key: "id",
                        sign: "=",
                        value: userId
                    }
                ]
            });
        };
        const onFail = (err) => {
            throw new AppError("Image Delete failed with Error Code: " + err);
        };
        await objectDelete(user.image, onSuccess, onFail);
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const getUserListings = async function (
    userId,
    pageNo,
    pageSize,
    statusId,
    categoryId,
    subcategoryId
) {
    const filters = [];

    // Validate userId, pageNo, and pageSize
    if (isNaN(Number(userId)) || Number(userId) <= 0) {
        throw new AppError(`Invalid UserId ${userId}`, 400);
    }
    if (isNaN(Number(pageNo)) || Number(pageNo) <= 0) {
        throw new AppError(`Please enter a positive integer for pageNo`, 400);
    }
    if (
        isNaN(Number(pageSize)) ||
        Number(pageSize) <= 0 ||
        Number(pageSize) > 20
    ) {
        throw new AppError(
            `Please enter a positive integer less than or equal to 20 for pageSize`,
            400
        );
    }

    // Validate and apply statusId filter
    if (statusId) {
        if (isNaN(Number(statusId)) || Number(statusId) <= 0) {
            throw new AppError(`Invalid status ${statusId}`, 400);
        }

        try {
            const status = await statusRepository.getOne({
                filters: [{ key: "id", sign: "=", value: statusId }]
            });
            if (!status) {
                throw new AppError(`Invalid Status '${statusId}' given`, 400);
            }
        } catch (err) {
            if (err instanceof AppError) throw err;
            throw new AppError(err);
        }
    }

    // Validate and apply categoryId and subcategoryId filters
    if (categoryId) {
        if (isNaN(Number(categoryId)) || Number(categoryId) <= 0) {
            throw new AppError(`Invalid category ${categoryId}`, 400);
        }

        try {
            const category = await categoryRepository.getOne({
                filters: [
                    {
                        key: "id",
                        sign: "=",
                        value: categoryId
                    }
                ]
            });
            if (!category) {
                throw new AppError(
                    `Invalid Category '${categoryId}' given`,
                    400
                );
            }

            // filters.categoryId = categoryId;
            filters.push({
                key: "categoryId",
                sign: "=",
                value: categoryId
            });

            if (subcategoryId) {
                if (
                    isNaN(Number(subcategoryId)) ||
                    Number(subcategoryId) <= 0
                ) {
                    throw new AppError(
                        `Invalid subcategory ${subcategoryId}`,
                        400
                    );
                }

                try {
                    const subcategory = await subCategoryRepository.getOne({
                        filters: [
                            {
                                key: "id",
                                sign: "=",
                                value: subcategoryId
                            },
                            {
                                key: "categoryId",
                                sign: "=",
                                value: categoryId
                            }
                        ]
                    });
                    if (!subcategory) {
                        throw new AppError(
                            `Invalid subCategory '${subcategoryId}' given`,
                            400
                        );
                    }
                } catch (err) {
                    if (err instanceof AppError) throw err;
                    throw new AppError(err);
                }
                // filters.subcategoryId = subcategoryId;
                filters.push({
                    key: "subcategoryId",
                    sign: "=",
                    value: subcategoryId
                });
            }
        } catch (err) {
            if (err instanceof AppError) throw err;
            throw new AppError(err);
        }
    }

    if (userId) {
        // filters.userId = userId;
        filters.push({
            key: "userId",
            sign: "=",
            value: userId
        });
    }
    try {
        const data = await listingRepository.retrieveListings({
            filters,
            pageNo,
            pageSize,
            statusId: statusId ? statusId : '*'
        });
        return data;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const deleteUser = async function (userId) {
    try {
        // implement transaction
        // const userData = await userRepo.getUserDataById(userId);
        const userData = await usersRepository.getOne({
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: userId
                }
            ]
        });
        if (!userData) {
            throw new AppError(`User with id ${userId} does not exist`, 404);
        }

        // const cityUsers = await userRepo.getuserCityMappings(userId);
        const cityUsersData = await userCityUserMappingRepository.getAll({
            filters: [
                {
                    key: "userId",
                    sign: "=",
                    value: userId
                }
            ],
            columns: ["cityId, cityUserId"]
        });
        const cityUsers = cityUsersData.rows;

        const userImageList = await getUserImages(userId);

        await imageDeleteAsync.deleteMultiple(
            userImageList.map((image) => ({ Key: image.Key._text }))
        );
        for (const cityUser of cityUsers) {
            // await database.callStoredProcedure(
            //     storedProcedures.DELETE_CITY_USER,
            //     [cityUser.cityUserId],
            //     cityUser.cityId,
            // );
            await usersRepository.deleteCityUserProcedure(
                cityUser.cityUserId,
                cityUser.cityId
            );
        }
        // await database.callStoredProcedure(storedProcedures.DELETE_CORE_USER, [
        //     userId,
        // ]);

        await usersRepository.deleteCoreUserProcedure(userId);
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const storeFirebaseUserToken = async function (
    userId,
    newFirebaseToken,
    deviceToken
) {
    try {
        const userData = await usersRepository.getOne({
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: userId
                }
            ]
        });
        if (!userData) {
            throw new AppError(`User with id ${userId} does not exist`, 404);
        }

        const response = await firebaseTokenRepository.getOne({
            filters: [
                {
                    key: "deviceAddress",
                    sign: "=",
                    value: deviceToken
                },
                {
                    key: "userId",
                    sign: "=",
                    value: userId
                }
            ]
        });
        if (!response) {
            const insertionData = {};
            insertionData.userId = userId;
            insertionData.firebaseToken = newFirebaseToken;
            insertionData.createdAt = getDateInFormate(new Date());
            insertionData.deviceAddress = deviceToken;
            await firebaseTokenRepository.create({
                data: insertionData
            });
        } else {
            const firebaseTokenUpdationData = response;
            firebaseTokenUpdationData.firebaseToken = newFirebaseToken;
            firebaseTokenUpdationData.createdAt = getDateInFormate(new Date());
            await firebaseTokenRepository.update({
                data: firebaseTokenUpdationData,
                filters: [
                    {
                        key: "deviceAddress",
                        sign: "=",
                        value: deviceToken
                    },
                    {
                        key: "userId",
                        sign: "=",
                        value: userId
                    }
                ]
            });
        }
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const getUserOnboardingDetail = async function (userId) {
    try {
        const userData = await usersRepository.getOne({
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: userId
                }
            ]
        });
        if (!userData) {
            throw new AppError(`User with id ${userId} does not exist`, 404);
        }

        const userInterests = await userPreferenceInterestsRepository.getAll({
            filters: [
                {
                    key: "userId",
                    sign: "=",
                    value: userId
                }
            ],
            columns: ["interestId"]
        });

        const interestIds = userInterests.rows.map(
            (interest) => interest.interestId
        );

        return {
            userType: userData.userType,
            cityId: userData.cityId,
            maritalStatus: userData.maritalStatus,
            accommodationPreference: userData.accommodationPreference
                ? userData.accommodationPreference.split(",")
                : [],
            interests: interestIds,
            onBoarded: userData.isOnBoarded
        };
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

const setUserType = async function (userId, userType) {
    try {
        const userData = await usersRepository.getOne({
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: userId
                }
            ]
        });
        if (!userData) {
            throw new AppError(`User with id ${userId} does not exist`, 404);
        }

        const updationData = {};
        updationData.userType = userType;

        await usersRepository.update({
            data: updationData,
            filters: [
                {
                    key: "id",
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

const setDemographics = async function (
    userId,
    cityId,
    maritalStatus,
    accommodationPreference
) {
    try {
        const userData = await usersRepository.getOne({
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: userId
                }
            ]
        });
        if (!userData) {
            throw new AppError(`User with id ${userId} does not exist`, 404);
        }

        const updationData = {};
        const cityExists = await citiesRepository.getOne({
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: cityId
                }
            ]
        });
        if (cityExists) {
            updationData.cityId = cityId;
        }
        updationData.maritalStatus = maritalStatus;
        updationData.accommodationPreference =
            accommodationPreference.join(",");

        await usersRepository.update({
            data: updationData,
            filters: [
                {
                    key: "id",
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

const setInterests = async function (userId, interestIds) {
    const transaction =
        await userPreferenceInterestsRepository.createTransaction();
    try {
        // Validate user existence
        const userData = await usersRepository.getOne({
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: userId
                }
            ]
        });
        if (!userData) {
            throw new AppError(`User with id ${userId} does not exist`, 404);
        }

        // Clear existing interests
        await userPreferenceInterestsRepository.deleteWithTransaction(
            {
                filters: [
                    {
                        key: "userId",
                        sign: "=",
                        value: userId
                    }
                ]
            },
            transaction
        );

        // Insert new interests if any
        if (interestIds.length > 0) {
            // Validate all interest IDs exist
            const existingInterests = await interestsRepository.getAll({
                filters: [
                    {
                        key: "id",
                        sign: "IN",
                        value: interestIds
                    }
                ]
            });

            if (
                !existingInterests ||
                existingInterests.rows.length !== interestIds.length
            ) {
                throw new AppError("Invalid interest IDs detected", 400);
            }

            // Insert new interests using Promise.all
            const insertPromises = interestIds.map((interestId) =>
                userPreferenceInterestsRepository.createWithTransaction(
                    {
                        data: {
                            userId,
                            interestId
                        }
                    },
                    transaction
                )
            );

            await Promise.all(insertPromises);
        }

        // Commit transaction
        await userPreferenceInterestsRepository.commitTransaction(transaction);
    } catch (err) {
        // Rollback transaction on error
        await userPreferenceInterestsRepository.rollbackTransaction(
            transaction
        );
        if (err instanceof AppError) throw err;
        throw new AppError(
            err.message || "An error occurred while setting interests"
        );
    }
};

const onboardingComplete = async function (userId) {
    try {
        // Validate user existence
        const userData = await usersRepository.getOne({
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: userId
                }
            ]
        });
        if (!userData) {
            throw new AppError(`User with id ${userId} does not exist`, 404);
        }

        // Update onboarding status
        await usersRepository.update({
            data: {
                isOnBoarded: true
            },
            filters: [
                {
                    key: "id",
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

const changePassword = async function (userId, oldPassword, newPassword) {
    try {

        const userData = await usersRepository.getOne({
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: userId
                }
            ]
        });
        if (!userData) {
            throw new AppError(`User with id ${userId} does not exist`, 404);
        }

        const currentPasswordCorrect = await bcrypt.compare(
            oldPassword,
            userData.password
        );
        if (!currentPasswordCorrect) {
            throw new AppError(
                `Incorrect current password given`,
                401,
                errorCodes.INVALID_PASSWORD
            );
        }

        if (oldPassword === newPassword) {
            throw new AppError('New password must be different from the old password', 400);
        }

        if (/\s/.test(newPassword)) {
            throw new AppError(
                `Password cannot contain spaces`,
                400,
                errorCodes.INVALID_PASSWORD
            );
        }

        // Enforce length 8-16
        if (newPassword.length < 8 || newPassword.length > 16) {
            throw new AppError(
                `Password must be between 8 and 16 characters`,
                400,
                errorCodes.INVALID_PASSWORD
            );
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?#&^])[A-Za-z\d@$!%*?#&^]{8,16}$/;

        if (!passwordRegex.test(newPassword)) {
            throw new AppError(
                `Password must be at least 8 characters long, include one uppercase letter, one number, and one special character.`,
                400,
                errorCodes.INVALID_PASSWORD
            );
        }

        const hashedPassword = await bcrypt.hash(
            newPassword,
            Number(process.env.SALT)
        );
        await usersRepository.update({
            data: {
                password: hashedPassword
            },
            filters: [
                {
                    key: "id",
                    sign: "=",
                    value: userId
                }
            ]
        });


    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }

}

const getUserPoints = async function (userId) {
    try {

        const userPointsResult = await userPointsRepo.getAll({
            filters: [
                {
                    key: "userId",
                    sign: "=",
                    value: userId
                }
            ]
        });

        const totalPoints = userPointsResult?.rows?.reduce(
            (sum, point) => sum + (Number(point?.totalPoints) || 0),
            0
        ) || 0;

        // TODO: stamp 
        const stamp = await userGamePointsRepo.getAll({
            filters: [
                {
                    key: "userId",
                    sign: "=",
                    value: userId
                }
            ]
        });

        return {
            totalPoints,
            stamp: stamp?.rows?.length || 0
        }
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }

}

const inviteUser = async (invitedByUserId, email, roleId, cityIds, language = "de") => {
    // Only Super Admin can invite
    const requestingUser = await usersRepository.getOne({
        filters: [{ key: "id", sign: "=", value: invitedByUserId }],
        columns: ["id", "roleId"],
    });
    if (!requestingUser || requestingUser.roleId !== roles.Admin) {
        throw new AppError("You are not allowed to access this resource", 403);
    }

    // Validate email format
    const emailRe = /^[a-z0-9]+(\.[a-z0-9]+)*@[a-z0-9.-]+\.[a-z]{2,}$/i;
    if (!email || !emailRe.test(email)) {
        throw new AppError("Invalid email given", 400);
    }

    // Validate roleId
    const allowedRoles = [roles["Content Creator"], roles.CityAdmin]; // 3 and 5
    if (!allowedRoles.includes(Number(roleId))) {
        throw new AppError(
            `Invalid roleId. Allowed values: ${allowedRoles.join(", ")} (Content Creator, City Admin)`,
            400
        );
    }

    // If CityAdmin, cityIds array is required and each must be valid
    let parsedCityIds = null;
    if (Number(roleId) === roles.CityAdmin) {
        if (!cityIds || !Array.isArray(cityIds) || cityIds.length === 0) {
            throw new AppError("cityIds (array) is required when inviting a City Admin", 400);
        }
        // Validate each cityId
        for (const cId of cityIds) {
            if (isNaN(Number(cId)) || Number(cId) <= 0) {
                throw new AppError(`Invalid cityId '${cId}' given`, 400);
            }
            const city = await citiesRepository.getOne({
                filters: [{ key: "id", sign: "=", value: Number(cId) }],
            });
            if (!city) {
                throw new AppError(`City with id = ${cId} does not exist`, 404);
            }
        }
        parsedCityIds = cityIds.map(Number);
    }

    // Check if email is already registered
    const existingUser = await usersRepository.getOne({
        filters: [{ key: "email", sign: "=", value: email }],
    });
    if (existingUser) {
        throw new AppError(`User with email '${email}' is already registered`, 400);
    }

    // Upsert invitation — delete any prior unused invite for this email, then insert fresh
    const existingInvite = await userInvitationsRepository.getByEmail(email);
    if (existingInvite) {
        await userInvitationsRepository.delete({
            filters: [{ key: "id", sign: "=", value: existingInvite.id }],
        });
    }
    await userInvitationsRepository.create({
        data: {
            email,
            roleId: Number(roleId),
            cityIds: parsedCityIds ? JSON.stringify(parsedCityIds) : null,
            invitedBy: invitedByUserId,
        },
    });

    // Send invitation email
    const lang = language === "en" ? "en" : "de";
    const inviteTemplate = require(`../emailTemplates/${lang}/inviteUser`);
    const { subject, body } = inviteTemplate(lang);
    await sendMail(email, subject, null, body);

    return { message: `Invitation sent to ${email}` };
};

const getInvitedUsers = async (roleId, cityId = null) => {
    if (roleId !== roles.Admin) {
        throw new AppError("You are not allowed to access this resource", 403);
    }
    try {
        return await userInvitationsRepository.getAllWithRegistrationStatus(cityId);
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

module.exports = {
    createGuestUser,
    findGuestUserByDeviceId,
    migrateGuestUser,
    register,
    login,
    getUserById,
    updateUser,
    refreshAuthToken,
    forgotPassword,
    resetPassword,
    sendVerificationEmail,
    verifyEmail,
    logout,
    getUsers,
    listLoginDevices,
    deleteLoginDevices,
    uploadUserProfileImage,
    deleteUserProfileImage,
    getUserListings,
    deleteUser,
    storeFirebaseUserToken,
    getUserOnboardingDetail,
    setUserType,
    setDemographics,
    setInterests,
    onboardingComplete,
    changePassword,
    getUserPoints,
    inviteUser,
    getInvitedUsers,
};
