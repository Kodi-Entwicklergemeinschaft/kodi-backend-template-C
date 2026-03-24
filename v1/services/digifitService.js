const userPointsRepo = require("../repository/userPointsRepo");
const equipmentRepo = require("../repository/equipmentRepo");
const userExerciseSessionRepo = require("../repository/userExerciseSessionRepo");
const favoriteEquipmentsRepo = require("../repository/favouriteEquipmentsRepo");
const userExerciseSetsRepo = require("../repository/userExerciseSetsRepo");
const { START_SESSION, SET_CONFIRMED, END_SESSION, ABORTED, IN_PROGRESS } = require("../constants/exerciseStatus");
const { translateObjectValues } = require("./translationService");
const trophies = require("../repository/trophiesRepo");
const gamesRepo = require('../repository/gamesRepo');
const stampsRepo = require('../repository/stampsRepo');
const levelsRepo = require('../repository/levelsRepo');
const userGamingSessionRepo = require('../repository/userGamingSessionRepo');
const userActivityLogRepo = require('../repository/userActivityLogRepo');
const userGamePointsRepo = require('../repository/userGamePointsRepo');
const userTrophiesRepo = require('../repository/userTrophiesRepo');
const { gameData, pictureLevel1, pictureUrls, gamesDescription } = require("../constants/digifitGames");
const AppError = require("../utils/appError");
const supportedLanguages = require("../constants/supportedLanguages");

const count = 20;

/**
 * Helper function to create a new game session and its activity log
 * @param {number} userId - The ID of the user
 * @param {number} gameId - The ID of the game
 * @param {number} levelId - The ID of the level
 * @returns {Promise<Object>} The created game session
 */
async function createNewGameSession(userId, gameId, levelId) {
    const gameSession = await userGamingSessionRepo.create({
        data: {
            userId,
            gameId,
            levelId,
            startedAt: new Date()
        }
    });

    const activity = await userActivityLogRepo.create({
        data: {
            userId,
            activityStatus: START_SESSION,
            referenceId: gameSession.id,
            locationId: 100,
            activityTime: new Date()
        }
    });

    return {gameSession, activity};
}
// Helper to reverse {id: name} map to {name: id}
const reverseLocationMap = (locationMap) =>
    Object.entries(locationMap).reduce((acc, [id, name]) => {
        acc[name] = id;
        return acc;
    }, {});

/**
 * Build fitness stats for a user
 * @param {number} userId - Authenticated user id
 * @param {string} [translate] - Optional language code to translate response
 * @returns {Promise<Object>} Response payload ready to be returned by controller
 */
const getFitStats = async (userId, translate) => {
    // Fetch user points
    const userPointsResult = await userPointsRepo.getAll({
        filters: [
            {
                key: "userId",
                sign: "=",
                value: userId,
            },
        ],
    });

    const totalUserPoints =
        userPointsResult?.rows?.reduce(
            (sum, point) => sum + (Number(point?.totalPoints) || 0),
            0
        ) || 0;

    const gamePointsResult =
        await userGamePointsRepo.getAll({
            filters: [
                { key: 'userId', sign: '=', value: userId }
            ]
        })
        
    const totalGamePoints = gamePointsResult?.rows?.reduce(
        (sum, point) => {
            console.log(point)
            return sum + (Number(point?.totalPoints) || 0)
        },
        0
    ) || 0;

    // Fetch equipments grouped by location & additional meta
    const {
        equipmentByLocation,
        locationMap,
        locationMapUrls,
    } = await equipmentRepo.getAllEquipmentForParcours();

    // Fetch completed sessions for user
    const { rows: userSessions = [] } = await userExerciseSessionRepo.getAll({
        filters: [
            { key: "userId", sign: "=", value: userId },
            { key: "isCompleted", sign: "=", value: true },
        ],
    });

    // Fetch favourites so we can flag them easily
    const favouriteEquipmentsResult = await favoriteEquipmentsRepo.getAll({
        filters: [{ key: "userId", sign: "=", value: userId }],
        columns: ["equipmentId"],
    });
    const favouriteIds = new Set(
        favouriteEquipmentsResult.rows.map((item) => item.equipmentId)
    );

    const reverseLocMap = reverseLocationMap(locationMap);

    // Build parcours structure
    const parcours = Object.entries(equipmentByLocation).map(
        ([locationName, equipmentList]) => ({
            name: locationName,
            locationId: parseInt(reverseLocMap[locationName]),
            mapImageUrl: locationMapUrls[reverseLocMap[locationName]] || "",
            showParcoursUrl: `/user-equipment-stats/${reverseLocMap[locationName] || locationName}`,
            stations: equipmentList.map((equipment) => {
                const session = userSessions.find(
                    (s) => s?.equipmentId === equipment?.id
                );
                return {
                    id: equipment?.id,
                    name: equipment?.name,
                    muscleGroups: equipment?.muscleGroup,
                    machineImageUrl: equipment?.machineImageUrl,
                    isFavorite: favouriteIds.has(equipment?.id),
                    isCompleted: session ? Boolean(session.isCompleted) : false,
                };
            }),
        })
    );

    const totalPoints = totalUserPoints + totalGamePoints;

    const response = {
        sourceId: 1,
        userStats: {
            points: totalPoints,
            trophies: totalPoints ? Math.floor(totalPoints / 25) : 0,
        },
        parcours,
        actions: {
            trophiesUrl: "",
            puzzleUrl: "",
        },
    };

    // Translate if requested
    return translate ? await translateObjectValues(response, translate, ['name', 'muscleGroups']) : response;
};

/**
 * Fetch exercise details along with related stations
 * @param {number} userId
 * @param {{equipmentId?: number|string, locationId?: number|string, equipmentSlug?: string}} params
 * @param {string} [translate]
 * @returns {Promise<Object>} payload
 */
const getExerciseDetails = async (userId, params, translate) => {
    let { equipmentId, locationId, equipmentSlug } = params;

    // Resolve equipment row
    let equipmentRow;
    if (equipmentSlug) {
        equipmentRow = await equipmentRepo.getEquipmentBySlug(
            equipmentSlug
        );
    } else {
        equipmentRow = await equipmentRepo.getEquipmentById(equipmentId);
    }
    if (!equipmentRow) {
        throw new Error(`Equipment not found`);
    }
    if (equipmentSlug) {
        locationId = equipmentRow.locationId;
        equipmentId = equipmentRow.id;
    }

    // Get or create session
    let userSession = await userExerciseSessionRepo.getOne({
        filters: [
            { key: "userId", sign: "=", value: userId },
            { key: "equipmentId", sign: "=", value: equipmentId },
        ],
        orderBy: ["startedAt"],
        isDescending: true,
    });
    if (userSession?.isCompleted) {
        userSession = await userExerciseSessionRepo.create({
            data: {
                userId,
                equipmentId,
                isCompleted: false,
                isAborted: true,
                startedAt: new Date(),
                completedSets: 0,
                completedReps: 0,
            },
        });
    }

    // Last set for this session
    const userExerciseSet = await userExerciseSetsRepo.getOne({
        filters: [
            { key: "sessionId", sign: "=", value: userSession?.id || "" },
        ],
        orderBy: ["createdAt"],
        isDescending: true,
    });

    // Completed sessions by user (for related stations)
    const completedSessions = await userExerciseSessionRepo.getAll({
        select: [
            "user_exercise_sessions.*",
            "equipment.locationId",
            "locations.name as locationName",
        ],
        filters: [
            { key: "userId", sign: "=", value: userId },
            { key: "isCompleted", sign: "=", value: true },
        ],
    });
    const completedEquipmentIds = completedSessions.rows.map((s) => s.equipmentId);

    // Related stations (same location, not completed, not current equipment)
    const relatedFilters = [
        { key: "locationId", sign: "=", value: locationId },
        { key: "id", sign: "!=", value: equipmentId },
    ];
    if (completedEquipmentIds.length) {
        relatedFilters.push({ key: "id", sign: "NOT IN", value: completedEquipmentIds });
    }
    const { rows: relatedRows } = await equipmentRepo.getAll({
        filters: relatedFilters,
        select: ["id", "name", "muscleGroup", "isFavorite", "machineImageUrls"],
        pageNo: 1,
        pageSize: 100,
    });

    // Favourites
    const favouriteEquipmentsResult = await favoriteEquipmentsRepo.getAll({
        filters: [{ key: "userId", sign: "=", value: userId }],
        columns: ["equipmentId"],
    });
    const favouriteIds = new Set(
        favouriteEquipmentsResult.rows.map((row) => row.equipmentId)
    );

    const relatedStations = relatedRows.map((equip) => ({
        id: equip.id,
        name: equip.name,
        muscleGroups: equip.muscleGroup || "Muskelgruppen",
        isFavorite: favouriteIds.has(equip.id),
        machineImageUrl: equip.machineImageUrls,
    }));

    // Equipment response
    const equipmentResp = {
        id: equipmentRow.id,
        name: equipmentRow.name,
        isFavorite: favouriteIds.has(equipmentRow.id),
        machineVideoUrl: equipmentRow.machineVideoUrls,
        description: equipmentRow.description,
        qrCodeIdentifier: equipmentRow.qrCodeIdentifier,
        sourceId: 1,
        recommendation: {
            sets:
                `${equipmentRow.minSets} - ${equipmentRow.recommendedSets} Sätze` ||
                "4 - 5 Sätze",
            repetitions:
                `${equipmentRow.minReps} - ${equipmentRow.recommendedReps} Wiederholungen` ||
                "8 - 12 Wiederholungen",
        },
        userProgress: {
            currentSet: userSession?.completedSets || 0,
            totalCompletedReps: userSession?.completedReps || 0,
            totalSets: equipmentRow.recommendedSets || 5,
            repetitionsPerSet: userExerciseSet?.reps || 12,
            isCompleted: Boolean(userSession?.isCompleted) || false,
        },
        actions: {
            scanExerciseUrl: "/scan-exercise",
        },
    };

    const response = { equipment: equipmentResp, relatedStations };
    return translate
        ? await translateObjectValues(response, translate, ['name', 'description', 'sets', 'repetitions', 'muscleGroups'])
        : response;
};

/**
 * Build user equipment stats for a specific location
 * @param {number} userId
 * @param {number|string} locationId
 * @param {string} [translate]
 * @returns {Promise<Object>} Response payload
 */
const getUserEquipmentStats = async (userId, locationId, translate) => {
    // Points for this location
    const userPointsResult = await userPointsRepo.getAll({
        filters: [
            { key: "userId", sign: "=", value: userId },
            { key: "locationId", sign: "=", value: locationId },
        ],
    });
    const userTotalPoints =
        userPointsResult?.rows?.reduce(
            (sum, point) => sum + (Number(point?.totalPoints) || 0),
            0
        ) || 0;

    const gamePointsResult = await userGamePointsRepo.getAll({
        filters: [
            { key: "userId", sign: "=", value: userId }
        ],
    });
    const gameTotalPoints =
        gamePointsResult?.rows?.reduce(
            (sum, point) => sum + (Number(point?.totalPoints) || 0),
            0
        ) || 0;

    // Completed sessions for user
    const { rows: userSessions = [] } = await userExerciseSessionRepo.getAll({
        filters: [
            { key: "userId", sign: "=", value: userId },
            { key: "isCompleted", sign: "=", value: true },
        ],
    });

    const { equipmentByLocation, locationMap } =
        await equipmentRepo.getAllEquipmentForParcours(count);
    const locationName = locationMap[locationId];
    const equipmentList = equipmentByLocation[locationName] || [];

    // Favourites
    const favouriteEquipmentsResult = await favoriteEquipmentsRepo.getAll({
        filters: [{ key: "userId", sign: "=", value: userId }],
        columns: ["equipmentId"],
    });
    const favouriteIds = new Set(
        favouriteEquipmentsResult.rows.map((row) => row.equipmentId)
    );

    const completed = [];
    const notCompleted = [];

    equipmentList.forEach((equipment) => {
        const session = userSessions.find((s) => s.equipmentId === equipment.id);
        const equipmentData = {
            id: equipment.id,
            name: equipment.name,
            muscleGroups: equipment.muscleGroup || "Muskelgruppen",
            machineImageUrl: equipment.machineImageUrl || null,
            isFavorite: favouriteIds.has(equipment.id),
            isCompleted: Boolean(session?.isCompleted) || false,
        };
        (equipmentData.isCompleted ? completed : notCompleted).push(equipmentData);
    });

    const totalPoints = userTotalPoints + gameTotalPoints;
    const response = {
        sourceId: 1,
        userStats: {
            points: totalPoints,
            trophies: totalPoints ? Math.floor(totalPoints / 25) : 0,
        },
        parcours: {
            name: locationName,
            locationId: Number(locationId),
            availableStation: notCompleted,
            completedStation: completed,
        },
        actions: {
            trophiesUrl: "/trophies",
            puzzleUrl: "/puzzle",
        },
    };

    return translate
        ? await translateObjectValues(response, translate, ['name', 'muscleGroups', 'description', 'sets', 'repetitions'])
        : response;
};

/**
 * Mark or unmark equipment as favourite for a user
 * @param {number} userId
 * @param {number|string} equipmentId
 * @param {number|string} locationId
 * @param {boolean} isFavorite
 * @returns {{isFavorite: boolean}}
 */
const markFavourite = async (userId, equipmentId, locationId, isFavorite) => {
    if (!isFavorite) {
        await favoriteEquipmentsRepo.delete({
            filters: [
                { key: "userId", sign: "=", value: userId },
                { key: "equipmentId", sign: "=", value: equipmentId },
            ],
        });
    } else {
        await favoriteEquipmentsRepo.create({
            data: { userId, equipmentId, locationId },
        });
    }
    return { isFavorite };
};

/**
 * Tracker business logic
 * Accepts all tracker request body and returns payload for controller
 */
const tracker = async (
    userId,
    { equipmentId, locationId, setNumber, reps, activityStatus }
) => {

    // Fetch equipment meta
    const equipmentRow = await equipmentRepo.getOne({
        filters: [{ key: "id", sign: "=", value: equipmentId }],
        columns: ["recommendedSets", "locationId"],
    });
    if (!equipmentRow) {
        throw new Error("Equipment not found");
    }

    locationId = equipmentRow.locationId;

    // Get or create session
    let userSession = await userExerciseSessionRepo.getOne({
        filters: [
            { key: "userId", sign: "=", value: userId },
            { key: "equipmentId", sign: "=", value: equipmentId },
            { key: "isCompleted", sign: "=", value: false },
        ],
        orderBy: ["updatedAt"],
        isDescending: true,
    });

    if (!userSession) {
        userSession = await userExerciseSessionRepo.create({
            data: {
                userId,
                equipmentId,
                isCompleted: false,
                isAborted: true,
                startedAt: new Date(),
                completedSets: 0,
                completedReps: 0,
            },
        });
    }

    // START_SESSION / ABORT handling
    if ([START_SESSION, ABORTED].includes(activityStatus)) {
        if (activityStatus === ABORTED) {
            // update last activity log status
            await userActivityLogRepo.update({
                filters: [{ key: "referenceId", sign: "=", value: userSession.id }],
                data: { activityStatus, updatedAt: new Date() },
                isDescending: true,
                limit: 1,
            });

            const newSession = await userExerciseSessionRepo.create({
                data: {
                    userId,
                    equipmentId,
                    isCompleted: false,
                    isAborted: true,
                    startedAt: new Date(),
                    completedSets: 0,
                    completedReps: 0,
                },
            });

            return {
                status: "Success",
                data: {
                    isCompleted: false,
                    completedSets: 0,
                    setNumber,
                    reps,
                    sessionId: newSession.id,
                    activityStatus: START_SESSION,
                    message: "New session started after previous abort",
                },
            };
        }

        // new activity log
        await userActivityLogRepo.create({
            data: {
                userId,
                locationId,
                activityStatus,
                referenceId: userSession.id,
                activityTime: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });

        return {
            status: "Success",
            data: {
                isCompleted: false,
                completedSets: 0,
                setNumber,
                reps,
                sessionId: userSession.id,
                activityStatus,
                message:
                    activityStatus === START_SESSION
                        ? "Session started successfully"
                        : "Session aborted successfully (new log created)",
            },
        };
    }

    // Check & upsert set
    const existingSet = await userExerciseSetsRepo.getOne({
        filters: [
            { key: "sessionId", sign: "=", value: userSession.id },
            { key: "setNumber", sign: "=", value: setNumber },
        ],
    });

    if (existingSet) {
        await userExerciseSetsRepo.update({
            filters: [{ key: "id", sign: "=", value: existingSet.id }],
            data: { reps, locationId, updatedAt: new Date() },
        });
    } else {
        await userExerciseSetsRepo.create({
            data: {
                sessionId: userSession.id,
                locationId,
                setNumber,
                reps,
                confirmedAt: new Date(),
            },
        });

        await userActivityLogRepo.update({
            filters: [{ key: "referenceId", sign: "=", value: userSession.id }],
            data: { activityStatus: SET_CONFIRMED, updatedAt: new Date() },
        });
    }

    // Count sets
    const { rows: allSets } = await userExerciseSetsRepo.getAll({
        filters: [{ key: "sessionId", sign: "=", value: userSession.id }],
    });
    const uniqueSetNumbers = new Set(allSets.map((s) => s.setNumber));
    const completedSetsCount = uniqueSetNumbers.size;
    const isSessionComplete = completedSetsCount >= equipmentRow.recommendedSets;
    const totalReps = allSets.reduce((sum, s) => sum + (parseInt(s.reps) || 0), 0);
    const isJustCompleted = isSessionComplete && !userSession.isCompleted;

    // Update session summary
    await userExerciseSessionRepo.update({
        filters: [{ key: "id", sign: "=", value: userSession.id }],
        data: {
            completedSets: completedSetsCount,
            completedReps: totalReps,
            isCompleted: isSessionComplete,
            isAborted: !isSessionComplete,
            endedAt: isJustCompleted ? new Date() : userSession.endedAt,
            updatedAt: new Date(),
        },
    });

    if (isJustCompleted) {
        await userActivityLogRepo.update({
            filters: [{ key: "referenceId", sign: "=", value: userSession.id }],
            data: { activityStatus: END_SESSION, updatedAt: new Date() },
        });

        await handlePointsAndTrophies(userId, equipmentId, locationId);
    }

    return {
        status: "Success",
        data: {
            sessionId: userSession.id,
            isCompleted: isSessionComplete,
            completedSets: completedSetsCount,
            setNumber,
            reps,
            message: isSessionComplete
                ? "Session completed successfully!"
                : "Set recorded successfully",
        },
    };
};

/** Helper copied from controller */
async function handlePointsAndTrophies(userId, equipmentId, locationId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let userPoints = await userPointsRepo.getOne({
        filters: [
            { key: "userId", sign: "=", value: userId },
            { key: "locationId", sign: "=", value: locationId },
            { key: "equipmentId", sign: "=", value: equipmentId },
        ],
    });

    if (!userPoints) {
        userPoints = await userPointsRepo.create({
            data: {
                userId,
                locationId,
                equipmentId,
                totalPoints: 0,
                dailyActivityCounter: 0,
                updatedAt: today,
            },
        });
    }

    const lastUpdated = userPoints.updatedAt
        ? new Date(userPoints.updatedAt)
        : new Date(0);

    const isNewDay = lastUpdated < today;
    const canAddPoints = isNewDay || (userPoints.dailyActivityCounter || 0) < 2;

    if (canAddPoints) {
        const newCounter = isNewDay
            ? 1
            : (userPoints.dailyActivityCounter || 0) + 1;
        const newTotalPoints = Number(userPoints.totalPoints || 0) + 1;

        await userPointsRepo.update({
            filters: [{ key: "id", sign: "=", value: userPoints.id }],
            data: {
                totalPoints: newTotalPoints,
                dailyActivityCounter: newCounter,
                updatedAt: new Date(),
            },
        });

        const updatedPoints = await userPointsRepo.getAll({
            filters: [{ key: "userId", sign: "=", value: userId }],
        });

        userPoints = updatedPoints.rows;

        const currentTrophyLevel = Math.floor(
            userPoints.reduce(
                (sum, p) => sum + (Number(p.totalPoints) || 0),
                0
            ) / 25
        );

        // Award trophies only up to trophy level 3 (75 total points). Beyond this, users keep accumulating points but no additional trophies are granted.
        if (currentTrophyLevel && currentTrophyLevel <= 3) {
            const existingTrophy = await userTrophiesRepo.getOne({
                filters: [
                    { key: "userId", sign: "=", value: userId },
                    { key: "locationId", sign: "=", value: locationId },
                    { key: "trophyLevel", sign: "=", value: currentTrophyLevel },
                ],
            });

            if (!existingTrophy) {
                await userTrophiesRepo.create({
                    data: {
                        userId,
                        locationId,
                        trophyLevel: currentTrophyLevel,
                        awardedAt: new Date(),
                    },
                });
            }
        }
    }
}

/**
 * Build offline fitness stats for offline mode
 * Logic migrated from controller without changes.
 */
const offlineFitStats = async function (req, res, next) {
    try {
        const userId = req.userId;
        const translate = req.query.translate;

        // Fetch user points grouped by location
        const userPoints = await userPointsRepo.getAll({
            filters: [{
                key: 'userId',
                sign: '=',
                value: userId
            }],
        });

        // Create a map of locationId to points
        const locationPointsMap = {};
        let totalUserPoints = 0;

        if (userPoints?.rows?.length) {
            userPoints.rows.forEach(point => {
                const locId = point.locationId;
                if (!locationPointsMap[locId]) {
                    locationPointsMap[locId] = 0;
                }
                locationPointsMap[locId] += Number(point.totalPoints) || 0;
                totalUserPoints += Number(point.totalPoints) || 0;
            });
        }

        const { equipmentByLocation, locationMap, locationMapUrls } = await equipmentRepo.getAllEquipmentForParcours();
        const reverseLocMap = reverseLocationMap(locationMap);

        // Get all user sessions
        const { rows: userSessions = [] } = await userExerciseSessionRepo.getAll({
            filters: [{
                key: 'userId',
                sign: '=',
                value: userId
            }, {
                key: 'isCompleted',
                sign: '=',
                value: true
            }]
        });

        // Get all favorite equipment IDs for the user
        const favoriteEquipments = await favoriteEquipmentsRepo.getAll({
            filters: [{
                key: 'userId',
                sign: '=',
                value: userId
            }],
            columns: ['equipmentId']
        });

        const favoriteEquipmentIds = new Set(favoriteEquipments.rows.map(fav => fav.equipmentId));

        // Create parcours data with stations grouped by location
        const parcours = Object.entries(equipmentByLocation).map(([location, equipmentList]) => {
            const locationId = reverseLocMap[location] ? parseInt(reverseLocMap[location]) : null;
            const locationPoints = locationId ? (locationPointsMap[locationId] || 0) : 0;

            return {
                name: location,
                locationId,
                mapImageUrl: locationId ? (locationMapUrls[locationId] || "") : "",
                showParcoursUrl: locationId ? `/user-equipment-stats/${locationId}` : "",
                points: locationPoints,
                trophies: locationPoints ? Math.floor(locationPoints / 25) : 0,
                stations: equipmentList.map(equipment => {
                    const session = userSessions.find(session => session?.equipmentId === equipment?.id);
                    return {
                        id: equipment?.id,
                        name: equipment?.name,
                        muscleGroups: equipment?.muscleGroup,
                        machineImageUrl: equipment?.machineImageUrl,
                        isFavorite: favoriteEquipmentIds.has(equipment?.id),
                        qrCodeIdentifier: equipment?.qrCodeIdentifier,
                        isCompleted: session ? Boolean(session.isCompleted) : false,
                        recommendedReps: equipment?.recommendedReps || 0,
                        recommendedSets: equipment?.recommendedSets || 0,
                        description: equipment?.description || "",
                        minReps: equipment?.minReps || 0,
                        minSets: equipment?.minSets || 0,
                        sets: `${equipment?.minSets} - ${equipment?.recommendedSets} Sätze` || "4 - 5 Sätze",
                        repetitions: `${equipment.minReps} - ${equipment?.recommendedReps} Wiederholungen` || "8 - 12 Wiederholungen"
                    };
                })
            };
        });

        const response = {
            sourceId: 1,
            userStats: {
                points: totalUserPoints,
                trophies: totalUserPoints ? Math.floor(totalUserPoints / 25) : 0
            },
            parcours,
            actions: {
                trophiesUrl: "",
                puzzleUrl: ""
            }
        };

        const translatedResponse = translate
            ? await translateObjectValues(response, translate, ['name', 'muscleGroups', 'description', 'sets', 'repetitions'])
            : response;

        return res.status(200).json({
            data: translatedResponse,
            status: "Fitness track details fetched successfully"
        });
    } catch (err) {
        return next(err);
    }
};

// User trophies logic migrated from controller
const userTrophies = async function (req, res, next) {
    try {
        const userId = req.userId || 1;
        const muscleGroup = "Muskelgruppen";
        const translate = req.query.translate;

        // Get all trophies
        const allTrophiesResult = await trophies.getAll({ filters: [] });
        const allTrophies = allTrophiesResult.rows || [];

        // Get user's earned trophies
        const userTrophiesResult = await userTrophiesRepo.getAll({
            filters: [{ key: 'userId', sign: '=', value: userId }]
        });
        const earnedTrophies = userTrophiesResult.rows || [];

        const earnedTrophyLevels = new Set(earnedTrophies.map(t => String(t.trophyLevel)));
        const totalEarned = earnedTrophies.length;
        const totalAvailable = allTrophies.length;
        const userPoints = (await userPointsRepo.getAll({ filters: [{ key: 'userId', sign: '=', value: userId }] })).rows;

        // Sort trophies once
        const sortedTrophies = earnedTrophies
            .slice()
            .sort((a, b) => new Date(b.awardedAt) - new Date(a.awardedAt));

        // Map trophy levels to details
        const trophyDetailsMap = allTrophies.reduce((map, trophy) => {
            map[trophy.id] = trophy;
            return map;
        }, {});

        const formatTrophy = (userTrophy) => {
            const trophyDetail = trophyDetailsMap[userTrophy.trophyLevel] || {};
            return {
                id: userTrophy.trophyLevel,
                name: trophyDetail.name || `Trophy Level ${userTrophy.trophyLevel}`,
                iconUrl: trophyDetail.trophyImageUrl || `https://example.com/trophies/trophy-${userTrophy.trophyLevel}.png`,
                isCompleted: true,
                muscleGroups: muscleGroup
            };
        };

        const formatAllTrophy = (trophy) => ({
            id: trophy.id,
            name: trophy.name || `Trophy ${trophy.id}`,
            iconUrl: trophy.trophyImageUrl || `https://example.com/trophies/trophy-${trophy.id}.png`,
            isCompleted: earnedTrophyLevels.has(String(trophy.id)),
            muscleGroups: muscleGroup
        });

        const response = {
            data: {
                sourceId: 1,
                userStats: {
                    points: userPoints.reduce((sum, point) => sum + (Number(point?.totalPoints) || 0), 0),
                    trophies: totalEarned
                },
                latestTrophies: sortedTrophies.slice(0, 3).map(formatTrophy),
                allTrophies: {
                    total: totalAvailable,
                    locked: totalAvailable - totalEarned,
                    trophies: allTrophies.map(formatAllTrophy)
                },
                trophiesReceived: {
                    unlocked: totalEarned,
                    total: totalAvailable,
                    trophies: sortedTrophies.slice(0, 2).map(formatTrophy)
                }
            },
            status: "User trophies data fetched successfully"
        };

        const translatedResponse = translate
            ? await translateObjectValues(response, translate, ['name', 'muscleGroups'])
            : response;

        return res.status(200).json(translatedResponse);
    } catch (error) {
        next(error);
    }
};

/**
 * Bulk trackers logic migrated from controller.
 * Accepts req,res,next and processes array of sessions.
 */
const bulkTrackers = async function (req, res, next) {
    try {
        const userId = req.userId || 10;
        const machineSessionsArray = req.body?.data || [];

        if (!Array.isArray(machineSessionsArray) || machineSessionsArray.length === 0) {
            throw new Error('Machine sessions array is required and cannot be empty');
        }

        // Process each machine session
        for (const machineObj of machineSessionsArray) {
            for (const [machineId, sessions] of Object.entries(machineObj)) {
                if (!Array.isArray(sessions)) continue;

                for (const session of sessions) {
                    const { setComplete, locationId, createdAt, updatedAt, setTimeList = [] } = session;
                    const equipmentId = parseInt(machineId);

                    // Validate input
                    if (!locationId || !createdAt || !updatedAt) {
                        console.warn(`Skipping session for machine ${machineId}: Missing required fields`);
                        continue;
                    }

                    // Create session
                    const userSession = await userExerciseSessionRepo.create({
                        data: {
                            userId,
                            equipmentId,
                            isCompleted: setComplete >= 5,
                            isAborted: setComplete < 5,
                            startedAt: new Date(createdAt),
                            endedAt: new Date(updatedAt),
                            completedSets: Math.min(setTimeList.length, setComplete),
                            completedReps: 12 * Math.min(setTimeList.length, setComplete)
                        }
                    });

                    // Create a single activity log entry for this session
                    const activityLog = await userActivityLogRepo.create({
                        data: {
                            userId,
                            locationId,
                            activityStatus: START_SESSION,
                            referenceId: userSession.id,
                            activityTime: new Date(createdAt),
                            createdAt: new Date(createdAt),
                            updatedAt: new Date(createdAt),
                        }
                    });

                    // Process each set
                    for (let i = 0; i < setTimeList.length; i++) {
                        const setTime = new Date(setTimeList[i]);

                        // Create set record
                        await userExerciseSetsRepo.create({
                            data: {
                                sessionId: userSession.id,
                                locationId,
                                setNumber: i + 1,
                                reps: 12,
                                confirmedAt: setTime,
                                createdAt: setTime,
                                updatedAt: setTime
                            }
                        });

                        // Update the activity log with the latest set information
                        await userActivityLogRepo.update({
                            filters: [{ key: 'id', sign: '=', value: activityLog.id }],
                            data: {
                                activityStatus: (i + 1) === setComplete ?
                                    (setComplete >= 5 ? END_SESSION : ABORTED) :
                                    SET_CONFIRMED,
                                activityTime: setTime,
                                updatedAt: setTime,
                            }
                        });
                    }

                    // Final update to the activity log with the end time
                    const finalStatus = setComplete >= 5 ? END_SESSION : ABORTED;
                    await userActivityLogRepo.update({
                        filters: [{ key: 'id', sign: '=', value: activityLog.id }],
                        data: {
                            activityStatus: finalStatus,
                            activityTime: new Date(updatedAt),
                            updatedAt: new Date(updatedAt),
                        }
                    });

                    // Handle points and trophies if session is complete
                    if (setComplete >= 5) {
                        await handlePointsAndTrophies(userId, equipmentId, locationId);
                    }
                }
            }
        }

        return res.status(200).json({
            status: 'Success',
            data: { message: 'Sessions processed successfully' }
        });
    } catch (err) {
        return next(err);
    }
};

const gamingList = async function (req, next) {
    try {
        const { translate } = req.query;
        const responseData = await gamesRepo.getAll();
        const structuredResponse = {
            sourceId: 1,
            games: responseData.rows.map(game => ({
                id: game?.id || null,
                name: game?.name || "",
                subDescription: game?.subDescription || "",
                gameImageUrl: game?.gameImageUrl || ""
            }))
        }

        const translatedResponse = translate
            ? await translateObjectValues(structuredResponse, translate, ['name', 'subDescription'])
            : structuredResponse;
        return translatedResponse
    } catch (err) {
        return next(err);
    }
};

const gameDetails = async function (req, next) {
    try {
        const { translate } = req.query;
        const { id } = req.params;
        const { userId } = req;
        const gameDetails = await gamesRepo.getOne({ filters: [{ key: 'id', sign: '=', value: id }] });
        const stamps = (await stampsRepo.getAll({ filters: [{ key: 'gameId', sign: '=', value: id }] }))?.rows || [];
        const levels = (await levelsRepo.getAll({ filters: [{ key: 'gameId', sign: '=', value: id }] }))?.rows || [];
        const moreGames = (await gamesRepo.getAll({ filters: [{ key: 'id', sign: '!=', value: id }] }))?.rows || [];

        // Get user's completed sessions for this game
        const completedSessions = await userGamingSessionRepo.getAll({
            filters: [
                { key: 'userId', sign: '=', value: userId },
                { key: 'gameId', sign: '=', value: id },
                { key: 'isCompleted', sign: '=', value: true }
            ]
        });

        // Get completed level IDs
        const completedLevelIds = new Set(
            completedSessions.rows?.map(session => session.levelId) || []
        );

        // Create a map of stamp IDs to their completion status
        const stampCompletionMap = new Map();

        // For each completed level, mark the corresponding stamp as completed
        completedLevelIds.forEach(levelId => {
            // Get stamp ID based on level ID (1-15 cycle)
            const stampId = ((levelId - 1) % 15) + 1;
            stampCompletionMap.set(stampId, true);
        });

        const structuredResponse = {
            sourceId: 1,
            game: {
                id: gameDetails?.id || null,
                name: gameDetails?.name || "",
                subDescription: gameDetails?.subDescription || "",
                description: gameDetails?.description || ""
            },
            stamps: stamps.map(stamp => ({
                id: stamp?.id || null,
                stampImageUrl: stamp?.stampImageUrl || "",
                isCompleted: stampCompletionMap.has(stamp?.id) || false
            })),
            levels: levels.map((level, index) => {
                const isFirstLevel = index === 0;
                const isCompleted = completedLevelIds.has(level?.id) || false;
                const prevLevel = levels[index - 1];
                const isPrevLevelCompleted = isFirstLevel ? true : (completedLevelIds.has(prevLevel?.id) || false);
                const isUnlocked = isFirstLevel || isPrevLevelCompleted;
                
                return {
                    id: level?.id || null,
                    name: level?.name || "",
                    timer: level?.timer || null,
                    levelImageUrl: level?.levelImageUrl || "",
                    isCompleted,
                    isUnlocked
                };
            }),
            moreGames: moreGames?.map(game => ({
                id: game?.id || null,
                name: game?.name || "",
                subDescription: game?.subDescription || "",
                gameImageUrl: game?.gameImageUrl || ""
            }))
        }

        const translatedResponse = translate
            ? await translateObjectValues(structuredResponse, translate, ['name', 'subDescription', 'description'])
            : structuredResponse;
        return translatedResponse
    } catch (err) {
        return next(err);
    }
};

const gameSteps = async function (req) {
    try{
        const { gameId, levelId } = req.params;
        const game = await levelsRepo.getOne({ filters: [{ key: 'gameId', sign: '=', value: gameId }, { key: 'id', sign: '=', value: levelId }] });
        if (!game) {
            throw new Error(`Game not found`);
        }
        const translate = req.query.translate;
        switch (Number(gameId)) {
        case 1:
            return await boldiFinder(
                game.gridRotation,
                req.userId,
                gameId,
                levelId,
                game.timer,
                translate
            );
        case 2:
            return await flipCatch(
                req.userId,
                gameId,
                levelId,
                game.timer,
                game.name,
                translate
            );
        case 3:
            return await mathHunt(
                req.userId,
                gameId,
                levelId,
                game.timer,
                game.name,
                translate
            );
        case 4:
            return await digitDash(
                game.gridRotation,
                req.userId,
                gameId,
                levelId,
                game.timer,
                game.name,
                translate
            );
        case 5:
            return await bilderSpiel(
                game.gridRotation,
                req.userId,
                gameId,
                levelId,
                game.timer,
                game.name,
                translate
            );
        default:
            throw new Error('Game not implemented');
        }
    } catch (err) {
        console.error('Error in gameSteps:', err);
        throw new AppError(err, 403, 'gameStepsError');
    }
};

const boldiFinder = async function (gridRotation, userId, gameId, levelId, timer, translate) {
    try {
        const gridSize = gridRotation;
        const startX = Math.floor(gridSize / 2);
        const startY = Math.floor(gridSize / 2);
        const position = { col: startY, row: startX };
        const totalSteps = gridSize + 2;
        const steps = [];
        const gameSession = await sessionUpdate(userId, gameId, levelId);

        for (let i = 0; i < totalSteps; i++) {
            const validDirections = [];

            if (position.row > 0) validDirections.push('up');
            if (position.row < gridSize - 1) validDirections.push('down');
            if (position.col > 0) validDirections.push('left');
            if (position.col < gridSize - 1) validDirections.push('right');

            if (validDirections.length === 0) {
                break;
            }

            const direction = validDirections[Math.floor(Math.random() * validDirections.length)];

            switch (direction) {
            case 'left': position.col--; break;
            case 'right': position.col++; break;
            case 'up': position.row--; break;
            case 'down': position.row++; break;
            default: break;
            }

            steps.push(direction);
        }
        const response = {
            subDescription: gamesDescription[gameId][levelId],
            grid: {row: gridSize, col: gridSize},
            startPosition: { row: startX, col: startY },
            finalPosition: { ...position },
            steps,
            totalSteps: steps.length,
            timer,
            sessionId: gameSession?.gameSession?.id,
            activityId: gameSession?.activity?.id
        };
        const translatedResponse = translate
            ? await translateObjectValues(response, translate, ['subDescription'])
            : response;
        return translatedResponse;
    } catch (err) {
        console.error('Error in boldiFinder:', err);
        throw err; // Let the error be handled by the calling function
    }
}

const flipCatch = async function (userId, gameId, levelId, timer, gameName, translate) {
    try {
        const gameSession = await sessionUpdate(userId, gameId, levelId);
        const level = parseInt(gameName.replace(/\D/g, '')) || 1;

        gameSession.currentWord = gameData[`level${level}`].words;
        gameSession.mirroredText = gameData[`level${level}`].sentences;
        gameSession.startTime = Date.now();
        gameSession.timeLimit = timer;
        gameSession.level = level;

        const response = {
            subDescription: gamesDescription[gameId][levelId],
            targetWords: gameData[`level${level}`].words,
            originalText: gameData[`level${level}`].sentences,
            timer,
            sessionId: gameSession?.gameSession?.id,
            activityId: gameSession?.activity?.id,
        };
        const translatedResponse = translate
            ? await translateObjectValues(response, translate, ['subDescription'])
            : response;
        return translatedResponse;
    } catch (err) {
        console.error('Error in flipCatch:', err);
        throw err;
    }
}

const mathHunt = async function (userId, gameId, levelId, timer, gameName, translate) {
    try {
        const gameSession = await sessionUpdate(userId, gameId, levelId);
        const level = parseInt(gameName.replace(/\D/g, '')) || 1;
        const config = {
            minNumbers: 3 + level,
            maxNumbers: 5 + level,
            minValue: 1,
            maxValue: 10 + (level * 2),
            operations: ['+', '-'].slice(0, 2 + level)
        };
        
        const generateProblem = () => {
            const numCount = Math.floor(Math.random() * (config.maxNumbers - config.minNumbers + 1)) + config.minNumbers;
            const numbers = [];
            const operations = [];
            
            for (let i = 0; i < numCount; i++) {
                numbers.push(Math.floor(Math.random() * (config.maxValue - config.minValue + 1)) + config.minValue);
                if (i < numCount - 1) {
                    operations.push(config.operations[Math.floor(Math.random() * config.operations.length)]);
                }
            }
            
            return { numbers, operations };
        };
        
        const calculate = (a, operator, b) => {
            switch (operator) {
            case '+': return a + b;
            case '-': return a - b;
            default: throw new Error(`Unknown operator: ${operator}`);
            }
        };

        const calculateAnswer = (problem) => {
            let result = problem.numbers[0];
            
            if (level === 2) {
                for (let i = 0; i < problem.operations.length; i++) {
                    result = calculate(result, problem.operations[i], problem.numbers[i + 1]);
                    result += 2;
                }
            } else {
                for (let i = 0; i < problem.operations.length; i++) {
                    result = calculate(result, problem.operations[i], problem.numbers[i + 1]);
                }
            }
            
            return Math.round(result * 100) / 100;
        };
        
        const problem = generateProblem();
        const correctAnswer = calculateAnswer(problem);
        
        /* const generateOptions = (correct) => {
            const options = [correct.toString()];
            while (options.length < 3) {
                let offset;
                do {
                    offset = Math.floor(Math.random() * 11) - 5;
                } while (offset === 0 || options.includes(correct + offset));
                
                options.push((correct + offset).toString());
            }
            
            return options.sort(() => Math.random() - 0.5);
        }; */
        const generateOptions = (correct) => {
            const correctNum = Number(correct);  // Convert to number once
            const options = [correctNum];  // Store numbers, not strings
            
            while (options.length < 3) {
                let newOption;
                do {
                    const offset = Math.floor(Math.random() * 11) - 5;  // -5 to 5
                    newOption = correctNum + offset;
                } while (newOption === correctNum || options.includes(newOption));
                
                options.push(newOption);
            }
            
            // Convert to strings only at the end
            return options.map(String).sort(() => Math.random() - 0.5);
        };
        
        const options = generateOptions(correctAnswer);
        
        const problemString = problem.numbers.reduce((acc, num, index) => {
            acc.push(num.toString());
            if (index < problem.operations.length) {
                acc.push(problem.operations[index]);
            }
            return acc;
        }, []);
        
        const response = {
            subDescription: gamesDescription[gameId][levelId],
            problem: problemString,
            options,
            correctAnswer,
            timer,
            sessionId: gameSession?.gameSession?.id,
            activityId: gameSession?.activity?.id
        };
        const translatedResponse = translate
            ? await translateObjectValues(response, translate, ['subDescription'])
            : response;
        return translatedResponse;
    } catch (err) {
        console.error('Error in mathHunt:', err);
        throw err;
    }
}

const digitDash = async function (gridRotation, userId, gameId, levelId, timer, gameName, translate) {
    try {
        const grid = { row: gridRotation, col: gridRotation };
        const gameSession = await sessionUpdate(userId, gameId, levelId);
        const level = parseInt(gameName.replace(/\D/g, '')) || 1;
        const minNumber = 1 + ((level - 1) * 10);
        const maxNumber = level * 10;
        const initial = Math.floor(Math.random() * (maxNumber - minNumber + 1)) + minNumber;

        /* const numbers = [];
        for (let i = 0; i < gridRotation * gridRotation; i++) {
            numbers.push(initial + i);
        }
        
        for (let i = numbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }
        
        const gridNumbers = [];
        for (let i = 0; i < gridRotation; i++) {
            gridNumbers.push(numbers.slice(i * gridRotation, (i + 1) * gridRotation));
        } */
        
        /* let colors = null;
        if (level === 2) {
            colors = [];
            for (let i = 0; i < gridRotation; i++) {
                const row = [];
                for (let j = 0; j < gridRotation; j++) {
                    const value = gridNumbers[i][j];
                    row.push(value % 2 === 0 ? 'RED' : 'BLUE');
                }
                colors.push(row);
            }
        } */

        let targetCondition = null;
        if (level === 2) {
            targetCondition = Math.random() < 0.5 ? 'EVEN_RED' : 'ODD_BLUE';
        }

        let forbiddenNumbers = [];
        if (level === 3) {
            const forbiddenCount = 4;
            const possibleForbidden = Array.from(
                {length: 25}, 
                (_, i) => initial + i
            );

            for (let i = possibleForbidden.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [possibleForbidden[i], possibleForbidden[j]] = [possibleForbidden[j], possibleForbidden[i]];
            }
            
            forbiddenNumbers = possibleForbidden.slice(0, forbiddenCount);
        }

        const response = {
            subDescription: gamesDescription[gameId][levelId],
            grid,
            initial,
            /* numbers: gridNumbers,
            colors, */
            targetCondition,
            forbiddenNumbers,
            timer,
            sessionId: gameSession?.gameSession?.id,
            activityId: gameSession?.activity?.id
        };
        const translatedResponse = translate
            ? await translateObjectValues(response, translate, ['subDescription'])
            : response;
        return translatedResponse;
    } catch (err) {
        console.error('Error in digitDash:', err);
        throw err;
    }
}

const bilderSpiel = async function (gridRotation, userId, gameId, levelId, timer, gameName, translate) {
    try {
        const gameSession = await sessionUpdate(userId, gameId, levelId);
        const level = parseInt(gameName.replace(/\D/g, '')) || 1;
        const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
        const getRandom = (arr, n) => shuffle([...arr]).slice(0, n);
        if(level === 1){
            const response = {
                grid: { row: gridRotation, col: 3 },
                subDescription: gamesDescription[gameId][levelId],
                sourceId: 1,
                pictureGrid: pictureLevel1,
                timer,
                sessionId: gameSession?.gameSession?.id,
                activityId: gameSession?.activity?.id,
            };
            const translatedResponse = translate
                ? await translateObjectValues(response, translate, ['subDescription'])
                : response;
            return translatedResponse;
        } else if (level === 2) {
            // 🧠 LEVEL 2: Shown 15 pairs one-by-one → user marks Correct/Wrong
            const totalPairs = 15;
            const selected = getRandom(pictureUrls, totalPairs * 2);
            const shownPairs = [];

            // First memorize pairs
            for (let i = 0; i < selected.length; i += 2) {
                shownPairs.push({ id: i / 2 + 1, image1: selected[i], image2: selected[i + 1] });
            }

            // Now create “check round” with some incorrect pairs
            const checkPairs = shownPairs.map(pair => ({ ...pair }));
            // Randomly replace some images to make them incorrect
            const incorrectCount = Math.floor(totalPairs * 0.3); // 30% wrong pairs
            const indicesToChange = getRandom([...Array(totalPairs).keys()], incorrectCount);

            indicesToChange.forEach(i => {
                // Ensure the index is valid before accessing the array
                if (i >= 0 && i < checkPairs.length) {
                    const randomImg = getRandom(pictureUrls, 1)[0];
                    checkPairs[i].image2 = randomImg;
                    checkPairs[i].isCorrect = false;
                }
            });

            // Mark all other pairs as correct
            checkPairs.forEach(p => { if (p.isCorrect === undefined) p.isCorrect = true });

            const response = {
                grid: { row: 3, col: 3 },
                subDescription: gamesDescription[gameId][levelId],
                sourceId: 1,
                memorizePairs: shownPairs,
                checkPairs,
                timer,
                sessionId: gameSession?.gameSession?.id,
                activityId: gameSession?.activity?.id,
            };
            const translatedResponse = translate
                ? await translateObjectValues(response, translate, ['subDescription'])
                : response;
            return translatedResponse;
        }

        else if (level === 3) {
            const totalPairs = 15;
            const selected = getRandom(pictureUrls, totalPairs * 2);
            const pairs = [];

            for (let i = 0; i < selected.length; i += 2) {
                pairs.push({ id: i / 2 + 1, image1: selected[i], image2: selected[i + 1] });
            }

            const allImages = pairs.flatMap((p, index) => [
                { id: index * 2 + 1, image: p.image1 },
                { id: index * 2 + 2, image: p.image2 }
            ]);
            const missingImage = getRandom(allImages, 1)[0];
            const filteredImages = allImages.filter(img => img.id !== missingImage.id);
            const shuffledImages = shuffle(filteredImages);
            const randomPosition = Math.floor(Math.random() * (shuffledImages.length + 1));
            const emptyImage = { id: null, image: 'admin/games/picturegame/empty.png' };
            const displayImages = [
                ...shuffledImages.slice(0, randomPosition).map(img => ({
                    id: img.id,
                    image: img.image
                })),
                emptyImage,
                ...shuffledImages.slice(randomPosition).map(img => ({
                    id: img.id,
                    image: img.image
                }))
            ];

            const response = {
                grid: { row: gridRotation, col: gridRotation },
                subDescription: gamesDescription[gameId][levelId],
                sourceId: 1,
                allImages,
                displayImages,
                missingImage,
                timer,
                sessionId: gameSession?.gameSession?.id,
                activityId: gameSession?.activity?.id,
            };
            const translatedResponse = translate
                ? await translateObjectValues(response, translate, ['subDescription'])
                : response;
            return translatedResponse;
        }
        const response = {
            grid: { row: gridRotation, col: gridRotation },
            subDescription: gamesDescription[gameId][levelId],
            sourceId: 1,
            pictureGrid: pictureLevel1,
            timer,
            sessionId: gameSession?.gameSession?.id,
            activityId: gameSession?.activity?.id,
        }
        const translatedResponse = translate
            ? await translateObjectValues(response, translate, ['subDescription'])
            : response;
        return translatedResponse;
    } catch (err) {
        console.error('Error in bilderSpiel:', err);
        throw err;
    }
}

const sessionUpdate = async function (userId, gameId, levelId) {
    let gameSession = null;
    if (userId && gameId && levelId) {
        // Check for existing active gaming session
        const existingSession = await userGamingSessionRepo.getOne({
            filters: [
                { key: 'userId', sign: '=', value: userId },
                { key: 'gameId', sign: '=', value: gameId },
                { key: 'levelId', sign: '=', value: levelId },
                { key: 'endedAt', sign: 'IS', value: null } // Active session hasn't ended
            ],
            orderBy: ['startedAt'],
            isDescending: true
        });

        if (existingSession) {
            // Check if there's an activity log for this session that's not aborted or ended
            const activityLog = await userActivityLogRepo.getOne({
                filters: [
                    { key: 'userId', sign: '=', value: userId },
                    { key: 'referenceId', sign: '=', value: existingSession.id },
                    { key: 'activityStatus', sign: 'IN', value: [START_SESSION] }
                ],
                orderBy: ['activityTime'],
                isDescending: true
            });

            if (activityLog) {
                // Use existing session
                gameSession = {gameSession: existingSession, activity: activityLog};
            } else {
                // Create new session if no active session found
                gameSession = await createNewGameSession(userId, gameId, levelId);
            }
        } else {
            // Create new session if no existing session found
            gameSession = await createNewGameSession(userId, gameId, levelId);
        }
    }
    return gameSession;
}

const gameTracker = async function (req, next) {
    try {
        const { sessionId, activityStatus } = req.body;
        
        // Get the current game session
        const gameSession = await userGamingSessionRepo.getOne({
            filters: [
                { key: 'id', sign: '=', value: sessionId },
                { key: 'userId', sign: '=', value: req.userId }
            ]
        });

        if (!gameSession) {
            throw new AppError('Game session not found', 404);
        }
        // Handle different activity statuses
        if (activityStatus === END_SESSION) {
            // Get or create user game points for this specific level
            const userGamePoints = await userGamePointsRepo.getOne({
                filters: [
                    { key: 'userId', sign: '=', value: req.userId },
                    { key: 'gameId', sign: '=', value: gameSession.gameId },
                    { key: 'levelId', sign: '=', value: gameSession.levelId }
                ]
            });

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            // const lastUpdated = userGamePoints ? new Date(userGamePoints.updatedAt) : null;
            // Check if it's a new day or first time
            // const isNewDay = !lastUpdated || lastUpdated < today;
            if (!userGamePoints) {
                // Create new entry if it doesn't exist
                await userGamePointsRepo.create({
                    data: {
                        userId: req.userId,
                        gameId: gameSession.gameId,
                        levelId: gameSession.levelId,
                        dailyActivityCounter: 1,
                        totalPoints: 1,  // Changed from totalPoints to match DB column
                        updatedAt: new Date()
                    }
                });
            }/*  else {
                // Always increment totalPoint if it's a new day or no activity today
                const shouldIncrement = isNewDay || userGamePoints.dailyActivityCounter === 0;
                const newTotalPoints = shouldIncrement ? (userGamePoints.totalPoints || 0) + 1 : userGamePoints.totalPoints;
                await userGamePointsRepo.update({
                    data: {
                        totalPoints: newTotalPoints,
                        dailyActivityCounter: 1,
                        updatedAt: new Date(),
                        // Only update these fields if they exist in your schema
                        ...(userGamePoints.dailyActivityCount !== undefined && { 
                            dailyActivityCount: 1 
                        })
                    },
                    filters: [
                        { key: 'id', sign: '=', value: userGamePoints.id },
                    ]
                });
            } */

            const getStampId = (levelId, totalStamps = 3) => ((levelId - 1) % totalStamps) + 1;
            const stampId = getStampId(gameSession.levelId);

            // Mark session as completed
            await userGamingSessionRepo.update({
                data: {
                    endedAt: new Date(),
                    isCompleted: true,
                    stampId,
                    isAborted: false
                },
                filters: [
                    { key: 'id', sign: '=', value: sessionId }
                ]
            });

            await userActivityLogRepo.update({
                data: {
                    activityStatus,
                    activityTime: new Date()
                },
                filters: [
                    { key: 'referenceId', sign: '=', value: sessionId },
                    { key: 'userId', sign: '=', value: req.userId },
                    { key: 'activityStatus', sign: 'IN', value: [START_SESSION, IN_PROGRESS] }
                ]
            });

            // Handle game trophies after updating points
            await handleGameTrophies(req.userId);

            return {
                ...gameSession,
                isCompleted: true,
                endedAt: new Date()
            };
        } else if (activityStatus === ABORTED) {
            // For ABORTED status, create a new session
            const newSession = await createNewGameSession(
                req.userId,
                gameSession.gameId,
                gameSession.levelId
            );

            // Update the existing activity log to mark as ABORTED
            await userActivityLogRepo.update({
                data: {
                    activityStatus,
                    activityTime: new Date()
                },
                filters: [
                    { key: 'referenceId', sign: '=', value: sessionId },
                    { key: 'userId', sign: '=', value: req.userId },
                    { key: 'activityStatus', sign: 'IN', value: [START_SESSION, IN_PROGRESS] }
                ]
            });

            return {
                ...newSession
            };
        } else if(activityStatus === IN_PROGRESS){
            await userActivityLogRepo.update({
                data: {
                    activityStatus,
                    activityTime: new Date()
                },
                filters: [
                    { key: 'referenceId', sign: '=', value: sessionId },
                    { key: 'userId', sign: '=', value: req.userId },
                    { key: 'activityStatus', sign: 'IN', value: [START_SESSION, IN_PROGRESS] }
                ]
            });
            return {
                ...gameSession,
                isCompleted: false,
                endedAt: null
            };
        }

        // Default behavior for other statuses
        const updatedSession = await sessionUpdate(req.userId, gameSession.gameId, gameSession.levelId);
        
        return {
            ...updatedSession
        };
    } catch (err) {
        console.log(err)
        return next(err);
    }
}

/**
 * Handle game trophies based on user's total points across all games
 * @param {number} userId - The ID of the user
 */
async function handleGameTrophies(userId) {
    try {
        // Get user's total points from game points
        const gamePointsResult = await userGamePointsRepo.getAll({
            filters: [
                { key: 'userId', sign: '=', value: userId }
            ]
        });

        // Calculate total points from game points
        const gamePoints = gamePointsResult.rows || [];
        const totalGamePoints = gamePoints.reduce((sum, point) => sum + (point.totalPoints || 0), 0);
        // Get points from userPointsRepo
        const userPointsResult = await userPointsRepo.getAll({
            filters: [
                { key: 'userId', sign: '=', value: userId }
            ]
        });
        const userPoints = userPointsResult.rows || [];
        const totalUserPoints = userPoints.reduce((sum, point) => sum + (point.totalPoints || 0), 0);
        // Calculate combined total points
        const totalPoints = totalGamePoints + totalUserPoints;
        // Calculate trophy level based on combined points (1 trophy per 25 points)
        const trophyLevel = Math.floor(totalPoints / 25);
        // If user has points but would get level 0, set to level 1
        const newTrophyLevel = trophyLevel > 0 ? trophyLevel : 0;
        // Check and award new trophy if level has increased
        const newTrophies = [];
        if (newTrophyLevel && newTrophyLevel <= 3) {
            // Check if the trophy already exists
            const existingTrophy = await userTrophiesRepo.getOne({
                filters: [
                    { key: 'userId', sign: '=', value: userId },
                    { key: 'locationId', sign: '=', value: 100 },
                    { key: 'trophyLevel', sign: '=', value: newTrophyLevel }
                ]
            });

            if (!existingTrophy) {
                await userTrophiesRepo.create({
                    data: {
                        userId,
                        locationId: 100, // Fixed locationId
                        trophyLevel: newTrophyLevel,
                        awardedAt: new Date()
                    }
                });
                newTrophies.push(newTrophyLevel);
            }
        }

        return {
            success: true,
            message: 'Trophies processed successfully',
            data: {
                totalPoints,
                gamePoints: totalGamePoints,
                userPoints: totalUserPoints,
                newTrophies
            }
        };
    } catch (error) {
        console.error('Error in handleGameTrophies:', error);
        return { totalPoints: 0, awardedTrophies: [] };
    }
}

const favoritesEquipments = async (
    userId,
    translate,
    locationIds,
    pageNo = 1,
    pageSize = 10) =>{
    try {

        if (!userId) {
            throw new AppError(`You are not allowed to access this resource`, 403);
        }
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

        // Normalize locationIds to array of numbers if provided as comma-separated string
        let normalizedLocationIds = locationIds;
        if (typeof locationIds === 'string' && locationIds.trim() !== '') {
            normalizedLocationIds = locationIds
                .split(',')
                .map((id) => parseInt(id.trim(), 10))
                .filter((n) => !isNaN(n));
        }

        const favoriteEquipment = await favoriteEquipmentsRepo.retrieveFavoriteEquipments({
            userId,
            locationIds: normalizedLocationIds,
            pageNo: pageNoNum,
            pageSize: pageSizeNum,
        });

        if (translate && supportedLanguages.includes(translate)) {
            try {
                await Promise.all(
                    favoriteEquipment.map(async (equipment) => {
                        await translateObjectValues(equipment, translate, ['name', 'muscleGroup', 'description', 'locationName']);
                    })
                );
            } catch (error) {
                console.error("Translation error:", error);
            }
        }

        return favoriteEquipment;
    }
    catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

module.exports = {
    getFitStats,
    getUserEquipmentStats,
    getExerciseDetails,
    markFavourite,
    tracker,
    offlineFitStats,
    userTrophies,
    bulkTrackers,
    gamingList,
    gameDetails,
    gameSteps,
    gameTracker,
    favoritesEquipments
};
