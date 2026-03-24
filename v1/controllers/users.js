const AppError = require("../utils/appError");
const errorCodes = require("../constants/errorCodes");
const userService = require("../services/users");
const notificationService = require("../services/notifications");
const tokenUtil = require("../utils/token");
const supportedLanguages = require("../constants/supportedLanguages");
const { translateObjectValues } = require("../services/translationService");

async function translateMessage(obj, translate, fields = ['message']) {
    if (!translate || !supportedLanguages.includes(translate)) return;
    try { await translateObjectValues(obj, translate, fields); } catch (_) {}
}

async function translateError(err, translate) {
    if (!translate || !supportedLanguages.includes(translate)) return;
    try {
        const wrapper = { message: err.message };
        await translateObjectValues(wrapper, translate, ['message']);
        err.message = wrapper.message;
    } catch (_) {}
}

const register = async function (req, res, next) {
    const payload = req.body;
    const translate = req.query.translate;
    payload.username = payload.username.trim().toLowerCase();
    try {
        if (payload.deviceId) {
            const existingGuestUser = await userService.findGuestUserByDeviceId(payload.deviceId);
            if (existingGuestUser) {
                await userService.updateUser(existingGuestUser.id, JSON.parse(JSON.stringify({
                    ...payload,
                    allowIdentityUpdate: true,
                    emailVerified: 0,
                    allNotificationsEnabled: 0,
                    isOnboarded: 0
                })));

                return res.status(200).json({
                    status: "success",
                    id: existingGuestUser.id
                });
            }
        }
        const id = await userService.register(payload);
        return res.status(200).json({
            status: "success",
            id
        });
    } catch (err) {
        await translateError(err, translate);
        return next(err);
    }
};

const login = async function (req, res, next) {
    const payload = req.body;
    const head = req.headers;
    const translate = req.query.translate;
    let sourceAddress = req.headers["x-forwarded-for"]
        ? req.headers["x-forwarded-for"].split(",").shift()
        : req.socket.remoteAddress;
    sourceAddress = sourceAddress.toString().replace("::ffff:", "");

    try {
        if (!payload.username && !payload.password) {
            throw new AppError(
                `Empty payload sent`,
                400,
                errorCodes.EMPTY_PAYLOAD
            );
        }

        if (!payload.username) {
            throw new AppError(
                `Username is not present`,
                400,
                errorCodes.MISSING_USERNAME
            );
        }

        if (!payload.password) {
            throw new AppError(
                `Password is not present`,
                400,
                errorCodes.MISSING_PASSWORD
            );
        }

        // Handle guest user migration if deviceId is provided
        if (payload.deviceId) {
            const guestUser = await userService.findGuestUserByDeviceId(payload.deviceId);
            if (guestUser) {
                const loginRes = await userService.login(
                    payload,
                    sourceAddress,
                    head.browsername,
                    head.devicetype
                );
                // If login is successful, update the user with guest reference and mark guest as deleted
                if (loginRes && loginRes.userId) {
                    await userService.migrateGuestUser(loginRes.userId, guestUser.id);
                }

                return res.status(200).json({
                    status: "success",
                    data: loginRes
                });
            }
        }

        // Normal login flow
        const loginRes = await userService.login(
            payload,
            sourceAddress,
            head.browsername,
            head.devicetype
        );

        res.status(200).json({
            status: "success",
            data: loginRes
        });
    } catch (err) {
        await translateError(err, translate);
        return next(err);
    }
};

const getUserById = async function (req, res, next) {
    const reqUserId = parseInt(req.userId);
    const cityUser = req.query.cityUser === "true";
    const cityId = req.query.cityId;

    try {

        const data = await userService.getUserById(
            cityUser,
            cityId,
            reqUserId
        );
        return res.status(200).json({
            status: "success",
            data
        });
    } catch (err) {
        return next(err);
    }
};

const updateUser = async function (req, res, next) {
    const payload = req.body;
    const userId = parseInt(req.userId);

    try {
        await userService.updateUser(userId, payload);
        res.status(200).json({
            status: "success"
        });
    } catch (err) {
        return next(err);
    }
};

const refreshAuthToken = async function (req, res, next) {
    const sourceAddress = req.headers["x-forwarded-for"]
        ? req.headers["x-forwarded-for"].split(",").shift()
        : req.socket.remoteAddress;
    const refreshToken = req.body.refreshToken;

    try {
        const data = await userService.refreshAuthToken(
            sourceAddress,
            refreshToken
        );
        return res.status(200).json({
            status: "success",
            data
        });
    } catch (err) {
        return next(err);
    }
};

const forgotPassword = async function (req, res, next) {
    const username = req.body.username;
    const language = req.body.language || "de";
    try {
        if (!username) {
            throw new AppError(`Username not present`, 400);
        }

        if (language !== "en" && language !== "de") {
            throw new AppError(`Incorrect language given`, 400);
        }
        await userService.forgotPassword(username, language);
        return res.status(200).json({
            status: "success"
        });
    } catch (err) {
        return next(err);
    }
};

const resetPassword = async function (req, res, next) {
    const userId = req.body.userId;
    const language = req.body.language || "de";
    const token = req.body.token;
    const password = req.body.password;

    try {
        if (!userId) {
            return next(new AppError(`Username not present`, 400));
        }

        if (!token) {
            return next(new AppError(`Token not present`, 400));
        }

        if (!password) {
            return next(new AppError(`Password not present`, 400));
        }

        if (language !== "en" && language !== "de") {
            return next(new AppError(`Incorrect language given`, 400));
        }
        await userService.resetPassword(userId, language, token, password);
        return res.status(200).json({
            status: "success"
        });
    } catch (err) {
        return next(err);
    }
};

const sendVerificationEmail = async function (req, res, next) {
    const email = req.body.email;
    const language = req.body.language || "de";

    try {
        if (!email) {
            return next(new AppError(`Email not present`, 400));
        }

        if (language !== "en" && language !== "de") {
            return next(new AppError(`Incorrect language given`, 400));
        }
        await userService.sendVerificationEmail(email, language);
        return res.status(200).json({
            status: "success"
        });
    } catch (err) {
        return next(err);
    }
};

const verifyEmail = async function (req, res, next) {
    const userId = req.body.userId;
    const language = req.body.language || "de";
    const token = req.body.token;

    try {
        if (!userId) {
            return next(new AppError(`Username not present`, 400));
        }

        if (!token) {
            return next(new AppError(`Token not present`, 400));
        }

        if (language !== "en" && language !== "de") {
            return next(new AppError(`Incorrect language given`, 400));
        }

        const message = await userService.verifyEmail(userId, token, language);
        return res.status(200).json({
            status: "success",
            message
        });
    } catch (err) {
        return next(err);
    }
};

const logout = async function (req, res, next) {
    const userId = parseInt(req.userId);
    const refreshToken = req.body.refreshToken;

    try {
        if (!userId) {
            throw new AppError(
                `You are not allowed to access this resource`,
                403
            );
        }
        if (!req.body.refreshToken) {
            throw new AppError(`Refresh Token not sent`, 403);
        }

        await userService.logout(userId, refreshToken);
        return res.status(200).json({
            status: "success"
        });
    } catch (err) {
        return next(err);
    }
};

const getUsers = async function (req, res, next) {
    const userName = req.query.username;
    const reqUserId = parseInt(req.userId);
    try {
        let userIds;
        if (req.query.ids) {
            const ids = req.query.ids.split(",").map((id) => parseInt(id));
            if (ids && ids.length > 10) {
                throw new AppError("You can only fetch upto 10 users", 400);
            }
            userIds = ids;
        }

        const users = await userService.getUsers(userIds, userName, reqUserId);
        res.status(200).json({
            status: "success",
            data: users
        });
    } catch (err) {
        return next(err);
    }
};

const listLoginDevices = async function (req, res, next) {
    const userId = parseInt(req.userId);
    const refreshToken = req.body.refreshToken;

    try {
        if (!userId) {
            throw new AppError(
                "You are not allowed to access this resource",
                401
            );
        }
        const tokens = await userService.listLoginDevices(userId, refreshToken);
        res.status(200).json({
            status: "success",
            data: tokens
        });
    } catch (err) {
        return next(err);
    }
};

const deleteLoginDevices = async function (req, res, next) {
    const userId = parseInt(req.userId);
    const id = req.query.id;
    if (userId !== req.userId) {
        return next(
            new AppError("You are not allowed to access this resource", 401)
        );
    }
    try {
        await userService.deleteLoginDevices(userId, id);
        res.status(200).json({
            status: "success"
        });
    } catch (err) {
        return next(err);
    }
};

const uploadUserProfileImage = async function (req, res, next) {
    try {
        const id = parseInt(req.userId);
        if (!id) {
            throw new AppError(
                `You are not allowed to access this resource`,
                403
            );
        }

        const { image } = req.files;
        if (!image) {
            throw new AppError(`Image not uploaded`, 400);
        }

        const updationData = await userService.uploadUserProfileImage(
            id,
            image
        );
        if (updationData) {
            return res.status(200).json({
                status: "success",
                data: updationData
            });
        } else {
            return res.status(500).json({
                status: "Failed!! Please try again"
            });
        }
    } catch (err) {
        return next(err);
    }
};

const deleteUserProfileImage = async function (req, res, next) {
    const userId = parseInt(req.userId);
    try {

        if (!userId) {
            throw new AppError(
                `You are not allowed to access this resource`,
                403
            );
        }
        await userService.deleteUserProfileImage(userId);
        res.status(200).json({
            status: "success"
        });
    } catch (err) {
        return next(err);
    }
};

const getUserListings = async function (req, res, next) {
    try {
        const userId = req.params.id;
        const pageNo = req.query.pageNo || 1;
        const pageSize = req.query.pageSize || 9;
        const categoryId = req.query.categoryId;
        const statusId = req.query.statusId;
        const subcategoryId = req.query.subcategoryId;
        const listings = await userService.getUserListings(
            userId,
            pageNo,
            pageSize,
            statusId,
            categoryId,
            subcategoryId
        );
        listings.forEach((listing) => delete listing.viewCount);
        return res.status(200).json({
            status: "success",
            data: listings
        });
    } catch (err) {
        return next(err);
    }
};

const getMyListings = async function (req, res, next) {
    try {
        const userId = req.userId;
        const pageNo = req.query.pageNo || 1;
        const pageSize = req.query.pageSize || 9;
        const categoryId = req.query.categoryId;
        const statusId = req.query.statusId;
        const subcategoryId = req.query.subcategoryId;

        if (isNaN(Number(userId)) || Number(userId) <= 0) {
            throw new AppError(`Invalid UserId ${userId}`, 400);
        }

        if (isNaN(Number(pageNo)) || Number(pageNo) <= 0) {
            throw new AppError(
                `Please enter a positive integer for pageNo`,
                400
            );
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
        const data = await userService.getUserListings(
            userId,
            pageNo,
            pageSize,
            statusId,
            categoryId,
            subcategoryId
        );
        if (data) {
            if (
                !process.env.IS_LISTING_VIEW_COUNT ||
                process.env.IS_LISTING_VIEW_COUNT === "False"
            ) {
                data.forEach((listing) => delete listing.viewCount);
            }
            return res.status(200).json({
                status: "success",
                data
            });
        }
        return res.status(200).json({
            status: "success",
            data: []
        });
    } catch (err) {
        return next(err);
    }
};

const deleteUser = async function (req, res, next) {
    const userId = parseInt(req.userId);
    try {
        if (!userId) {
            throw new AppError(
                `You are not allowed to access this resource`,
                403
            );
        }
        await userService.deleteUser(userId);
        res.status(200).json({
            status: "success"
        });
    } catch (err) {
        return next(err);
    }
};

const storeFirebaseUserToken = async function (req, res, next) {
    const userId = parseInt(req.params.id);
    const token = req.body.token;
    const deviceToken = req.body.deviceId;

    try {
        if (isNaN(Number(userId)) || Number(userId) <= 0) {
            throw new AppError(`Invalid UserId ${userId}`, 404);
        }
        if (userId !== req.userId) {
            throw new AppError(
                `You are not allowed to access this resource`,
                403
            );
        }
        if (!token) {
            throw new AppError(`Fire base token not present`, 400);
        }
        if (!deviceToken) {
            throw new AppError(`Device Id not present`, 400);
        }
        await userService.storeFirebaseUserToken(userId, token, deviceToken);
        res.status(200).json({
            status: "success"
        });
    } catch (err) {
        return next(err);
    }
};

const updateAllNotifications = async function (req, res, next) {
    const userId = parseInt(req.params.id);
    const notificationStatus = req.body.enabled;
    try {
        if (isNaN(Number(userId)) || Number(userId) <= 0) {
            throw new AppError(`Invalid UserId ${userId}`, 404);
        }
        if (userId !== req.userId) {
            throw new AppError(
                `You are not allowed to access this resource`,
                403
            );
        }
        const resp = await notificationService.updateAllNotifications(
            userId,
            notificationStatus
        );
        res.status(200).json({
            status: "success",
            data: resp.message
        });
    } catch (err) {
        return next(err);
    }
};

const getUserNotificationPreference = async function (req, res, next) {
    const userId = parseInt(req.params.id);

    try {
        if (isNaN(Number(userId)) || Number(userId) <= 0) {
            throw new AppError(`Invalid UserId ${userId}`, 404);
        }
        if (userId !== req.userId) {
            throw new AppError(
                `You are not allowed to access this resource`,
                403
            );
        }
        const notificationPreference =
            await notificationService.getUserNotificationPreference(userId);
        res.status(200).json({
            status: "success",
            data: notificationPreference
        });
    } catch (err) {
        return next(err);
    }
};

const updateUserNotificationPreference = async function (req, res, next) {
    const userId = parseInt(req.params.id);
    const preferences = req.body;

    try {
        if (isNaN(Number(userId)) || Number(userId) <= 0) {
            throw new AppError(`Invalid UserId ${userId}`, 404);
        }
        if (userId !== req.userId) {
            throw new AppError(
                `You are not allowed to access this resource`,
                403
            );
        }
        const response =
            await notificationService.updateUserNotificationPreference(
                userId,
                preferences
            );
        res.status(200).json({
            status: "success",
            data: response.message
        });
    } catch (err) {
        return next(err);
    }
};

const getUserOnboardingDetail = async function (req, res, next) {
    const userId = parseInt(req.userId);

    try {
        if (!userId) {
            throw new AppError(
                `You are not allowed to access this resource`,
                403
            );
        }
        const onboardingDetail = await userService.getUserOnboardingDetail(
            userId
        );
        res.status(200).json({
            status: "success",
            data: onboardingDetail
        });
    } catch (err) {
        return next(err);
    }
}

const setUserType = async function (req, res, next) {
    const { userType } = req.body;
    const userId = parseInt(req.userId);

    if (!["tourist", "citizen"].includes(userType)) {
        return res
            .status(400)
            .json({ success: false, message: "Invalid user type" });
    }

    try {
        if (!userId) {
            throw new AppError(
                `You are not allowed to access this resource`,
                403
            );
        }

        await userService.setUserType(userId, userType);
        res.json({ success: true, message: "User type updated successfully" });
    } catch (err) {
        return next(err);
    }
};

const setDemographics = async function (req, res, next) {
    const userId = parseInt(req.userId);
    const { cityId, maritalStatus, accommodationPreference } = req.body;

    // Validate enum values
    const validStatus = ["alone", "married", "with_family"].includes(
        maritalStatus
    );
    // make accommodationPreference to take array and can be empty
    const validAccommodation =
        Array.isArray(accommodationPreference) &&
        accommodationPreference.every((pref) =>
            ["dog", "low_barrier"].includes(pref)
        );

    if (!validStatus || !validAccommodation) {
        return res
            .status(400)
            .json({ success: false, message: "Invalid input values" });
    }

    try {
        if (isNaN(Number(userId)) || Number(userId) <= 0) {
            throw new AppError(`Invalid UserId ${userId}`, 404);
        }
        if (!userId) {
            throw new AppError(
                `You are not allowed to access this resource`,
                403
            );
        }
        // Update user demographics
        await userService.setDemographics(
            userId,
            cityId,
            maritalStatus,
            accommodationPreference
        );

        res.json({ success: true, message: "Demographic preferences updated" });
    } catch (err) {
        return next(err);
    }
};

// Guest user login
const loginGuest = async function (req, res, next) {
    const { deviceId } = req.body;

    if (!deviceId) {
        return next(
            new AppError(
                `Device ID is required`,
                400,
                errorCodes.MISSING_DEVICE_ID
            )
        );
    }

    try {
        // Check if guest user exists with this device ID
        let user = await userService.findGuestUserByDeviceId(deviceId);

        // If user doesn't exist, create a new guest user
        if (!user) {
            const guestUserData = {
                username: deviceId,
                email: `guest_${Date.now()}@example.com`,
                password: null,
                roleId: 4,
                firstname: 'Guest',
                lastname: 'User',
                phoneNumber: null,
                image: null,
                description: null,
                website: null,
                emailVerified: 1,
                socialMedia: null,
                allNotificationsEnabled: 1,
                cityId: null,
                maritalStatus: null,
                accommodationPreference: null,
                userType: null,
                isOnBoarded: 1,
                isDeleted: 0
            };
            user = await userService.createGuestUser(guestUserData);
        }

        const accessToken = tokenUtil.generateGuestToken({
            userId: user.id,
            roleId: user.roleId,
        });

        return res.status(200).json({
            status: 'success',
            data: {
                userId: user.id,
                accessToken
            }
        });
    } catch (error) {
        return next(error);
    }
};

const setInterests = async function (req, res, next) {
    const userId = parseInt(req.userId);
    const { interestIds } = req.body;

    if (!Array.isArray(interestIds)) {
        return res
            .status(400)
            .json({ success: false, message: "Invalid interests format" });
    }

    try {
        if (!userId) {
            throw new AppError(
                `You are not allowed to access this resource`,
                403
            );
        }
        await userService.setInterests(userId, interestIds);
        res.json({ success: true, message: "Interests updated successfully" });
    } catch (err) {
        return next(err);
    }
};

const onboardingComplete = async function (req, res, next) {
    const userId = parseInt(req.userId);

    try {
        if (!userId) {
            throw new AppError(
                `You are not allowed to access this resource`,
                403
            );
        }
        await userService.onboardingComplete(userId);
        res.json({
            success: true,
            message: "Onboarding status updated successfully"
        });
    } catch (err) {
        return next(err);
    }
};

const changePassword = async function (req, res, next) {
    const userId = req.userId;
    const { oldPassword, newPassword } = req.body;

    try {
        if (!userId) {
            throw new AppError(
                `You are not allowed to access this resource`,
                403
            );
        }
        if (!oldPassword || !newPassword) {
            throw new AppError(
                `Invalid input values`,
                400
            );
        }

        await userService.changePassword(userId, oldPassword, newPassword);
        res.json({
            success: true,
            message: "Password changed successfully"
        });
    } catch (err) {
        return next(err);
    }
};

const getUserPoints = async function (req, res, next) {
    const userId = req.userId;

    try {
        if (!userId) {
            throw new AppError(
                `You are not allowed to access this resource`,
                403
            );
        }

        const result = await userService.getUserPoints(userId);
        res.json({
            success: true,
            data: result
        });
    } catch (err) {
        return next(err);
    }
};


const inviteUser = async function (req, res, next) {
    const { email, roleId, cityIds, language } = req.body;
    const invitedByUserId = req.userId;
    const translate = req.query.translate;

    try {
        const result = await userService.inviteUser(invitedByUserId, email, roleId, cityIds, language);
        await translateMessage(result, translate);
        res.status(200).json({
            status: "success",
            message: result.message,
        });
    } catch (err) {
        await translateError(err, translate);
        return next(err);
    }
};

const getInvitedUsers = async function (req, res, next) {
    const translate = req.query.translate;

    try {
        const cityId = req.query.cityId ? Number(req.query.cityId) : null;
        const data = await userService.getInvitedUsers(req.roleId, cityId);
        res.status(200).json({
            status: "success",
            data,
        });
    } catch (err) {
        await translateError(err, translate);
        return next(err);
    }
};

module.exports = {
    register,
    login,
    loginGuest,
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
    getMyListings,
    storeFirebaseUserToken,
    updateAllNotifications,
    getUserNotificationPreference,
    updateUserNotificationPreference,
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

