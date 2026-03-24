const admin = require("firebase-admin");
const firebaseRepository = require("../repository/firebaseTokenRepo");
const exceptionRepository = require("../repository/exceptionsRepo");
const usersRepository = require("../repository/userRepo");
const citiesRepository = require("../repository/citiesRepo");
const cityTypes = require("../constants/cityTypes");
const serviceAccount = process.env.FIREBASE_PRIVATE
    ? JSON.parse(process.env.FIREBASE_PRIVATE)
    : {};
const getDateInFormate = require("../utils/getDateInFormate");

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
} catch (err) {
    if (!err.message.includes("The default Firebase app already exists."))
        console.log("error in firebase admin initialization", err);
}

async function sendPushNotificationToAll(
    topic = "warnings",
    title = "New Notification",
    body = "Check it out",
    data = null,
) {
    try {
        if (!serviceAccount) return false;

        const message = {
            topic,
            notification: {
                title,
                body,
            },
            data,
        };
        const response = await admin.messaging().send(message);
        return response;
    } catch (err) {
        try {
            const occuredAt = new Date();
            // await exceptionRepository.addException(
            //     err.message ?? "no message",
            //     err.stack ?? "no stack",
            //     getDateInFormate(occuredAt),
            // );
            await exceptionRepository.create({
                message: err.message ?? "no message",
                stackTrace: err.stack ?? "no stack",
                occuredAt: getDateInFormate(occuredAt),
            })
        } catch (err) { }
        return false;
    }
}

async function sendPushNotificationsToUsers(cityIds, categoryId, title = "", body = "Check it out", data = null) {
    try {
        if (!serviceAccount) return false;
        const users = await usersRepository.getUsersForNotification(cityIds, categoryId);
        if (!users || users.length === 0) {
            return false;
        }
        const userIds = users.map(user => user.userId);
        await sendPushNotifications(userIds, title, body, data);
    } catch (error) {
        return false;
    }
}

async function sendPushNotificationsToAdmin(cityIds, categoryId, title = "New Notification from a User", body = "Please verify the listing", data = null) {
    try {
        if (!serviceAccount) return false;
        const AdminUsers = await usersRepository.getAll({
            filters: [
                {
                    key: "roleId",
                    sign: "=",
                    value: 1
                }
            ]
        });
        if (!AdminUsers || AdminUsers.length === 0) {
            return false;
        }
        const AdminUserIds = AdminUsers.rows.map(user => user.id);
        const users = await usersRepository.getUsersForNotificationWithUserFilter(cityIds, categoryId, AdminUserIds);
        const userIds = users.map(user => user.userId);
        await sendPushNotifications(userIds, title, body, data);
    } catch (error) {
        return false;
    }
}


async function sendListingNotificationToUsers(cityIds, title = "Neue Meldung", body = "Check it out", data = null) {
    try {
        if (!serviceAccount) return false;
        if (!cityIds || cityIds.length === 0) return false;

        // Fetch city details to check types (district/municipality)
        const citiesResp = await citiesRepository.getAll({
            filters: [{ key: "id", sign: "IN", value: cityIds }],
            columns: "id,type"
        });
        const cities = citiesResp.rows || [];

        // Separate parent-level cities (district/municipality) from leaf cities
        const parentCityIds = cities
            .filter(c => c.type === cityTypes.DISTRICT_ADMIN || c.type === cityTypes.MUNICIPALITY)
            .map(c => c.id);
        const leafCityIds = cities
            .filter(c => c.type !== cityTypes.DISTRICT_ADMIN && c.type !== cityTypes.MUNICIPALITY)
            .map(c => c.id);

        // Resolve child cities for districts/municipalities
        let childCityIds = [];
        if (parentCityIds.length > 0) {
            childCityIds = await citiesRepository.getAllChildCityIds(parentCityIds);
        }

        // Combine all city IDs and deduplicate
        const allCityIds = [...new Set([...leafCityIds, ...parentCityIds, ...childCityIds])];
        if (allCityIds.length === 0) return false;

        // Get users by onboarding city (includes users with cityId = NULL)
        const users = await usersRepository.getUsersByOnboardingCity(allCityIds);
        if (!users || users.length === 0) return false;

        // Deduplicate user IDs
        const userIds = [...new Set(users.map(u => u.userId))];
        console.log("userIds", userIds, "cityIds", allCityIds);
        await sendPushNotifications(userIds, title, body, data);
        return true;
    } catch (error) {
        console.error("Error in sendListingNotificationToUsers:", error);
        return false;
    }
}

async function sendListingUpdateNotificationToUsers(cityIds, title = "Eilmeldung", body = "Check it out", data = null) {
    try {
        if (!serviceAccount) return false;
        if (!cityIds || cityIds.length === 0) return false;

        // Fetch city details to check types (district/municipality)
        const citiesResp = await citiesRepository.getAll({
            filters: [{ key: "id", sign: "IN", value: cityIds }],
            columns: "id,type"
        });
        const cities = citiesResp.rows || [];

        // Separate parent-level cities (district/municipality) from leaf cities
        const parentCityIds = cities
            .filter(c => c.type === cityTypes.DISTRICT_ADMIN || c.type === cityTypes.MUNICIPALITY)
            .map(c => c.id);
        const leafCityIds = cities
            .filter(c => c.type !== cityTypes.DISTRICT_ADMIN && c.type !== cityTypes.MUNICIPALITY)
            .map(c => c.id);

        // Resolve child cities for districts/municipalities
        let childCityIds = [];
        if (parentCityIds.length > 0) {
            childCityIds = await citiesRepository.getAllChildCityIds(parentCityIds);
        }

        // Combine all city IDs and deduplicate
        const allCityIds = [...new Set([...leafCityIds, ...parentCityIds, ...childCityIds])];
        if (allCityIds.length === 0) return false;

        // Get users by onboarding city ONLY (excludes cityId=NULL users — they already got notified on creation)
        const users = await usersRepository.getUsersByOnboardingCityOnly(allCityIds);
        if (!users || users.length === 0) return false;

        // Deduplicate user IDs
        const userIds = [...new Set(users.map(u => u.userId))];
        console.log("userIds", userIds, "cityIds", allCityIds);
        await sendPushNotifications(userIds, title, body, data);
        return true;
    } catch (error) {
        console.error("Error in sendListingUpdateNotificationToUsers:", error);
        return false;
    }
}

async function sendPushNotifications(userIds, title = "", body = "Check it out", data = null) {
    try {
        if (!serviceAccount) return false;

        const tokenPromises = userIds.map(async (userId) => {
            const { rows } = await firebaseRepository.getAll({
                columns: "firebaseToken",
                filters: [{ key: "userId", sign: "=", value: userId }],
            });
            return rows.map(row => row.firebaseToken);
        });

        const tokensList = (await Promise.all(tokenPromises)).flat();

        const tokens = tokensList.filter(token => token);
        if (!tokens || tokens.length === 0) {
            return false;
        }

        const sendPromises = tokens.map(async (token) => {
            const message = {
                token,
                notification: {
                    title,
                    body,
                },
                data
            };
            try {
                return await admin.messaging().send(message);
            } catch (error) {
                console.error(`Error sending to token ${token.firebaseToken}:`, error);
                return null;
            }
        });
        await Promise.all(sendPromises);
    } catch (error) {
        try {
            const occuredAt = new Date();
            await exceptionRepository.create(
                error.message ?? "no message",
                error.stack ?? "no stack",
                getDateInFormate(occuredAt),
            );
        } catch (error) { }
        return false;
    }
    return true;
}

module.exports = {
    sendPushNotificationToAll,
    sendPushNotificationsToUsers,
    sendPushNotificationsToAdmin,
    sendListingNotificationToUsers,
    sendListingUpdateNotificationToUsers
};
