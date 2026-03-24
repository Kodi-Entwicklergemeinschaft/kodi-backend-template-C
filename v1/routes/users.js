const express = require("express");
const router = express.Router();
const authentication = require("../middlewares/authentication");
const optionalAuthentication = require("../middlewares/optionalAuthentication");
const {
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
    // getUserListings,
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
    loginGuest,
    changePassword,
    getUserPoints,
    inviteUser,
    getInvitedUsers,
} = require("../controllers/users");

const filterNonPostRequests = (req, res, next) => {
    if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed"); // Return 405 Method Not Allowed for non-POST requests
    }
    next(); // Proceed to the next middleware
};

router.use("/login", filterNonPostRequests);
router.use("/register", filterNonPostRequests);

router.post("/login", login);

router.post("/register", register);

router.post("/guest/login", loginGuest);

router.get("/myListings", authentication, getMyListings);

// router.get("/:id", getUserById);

router.get("/me", authentication, getUserById);

router.patch("/", authentication, updateUser);

router.delete("/", authentication, deleteUser);

router.delete("/imageDelete", authentication, deleteUserProfileImage);

router.post("/imageUpload", authentication, uploadUserProfileImage);

// router.get("/:id/listings", getUserListings);

router.post("/refresh", refreshAuthToken);

router.post("/forgotPassword", forgotPassword);

router.post("/resetPassword", resetPassword);

router.post("/sendVerificationEmail", sendVerificationEmail);

router.post("/verifyEmail", verifyEmail);

router.post("/logout", authentication, logout);

router.get("/", optionalAuthentication, getUsers);

router.post("/loginDevices", authentication, listLoginDevices);

router.delete("/loginDevices", authentication, deleteLoginDevices);

router.post(
    "/:id/storeFirebaseUserToken",
    authentication,
    storeFirebaseUserToken
);

router.post(
    "/:id/notificationPreference",
    authentication,
    updateAllNotifications
);

router.get(
    "/:id/notificationPreference",
    authentication,
    getUserNotificationPreference
);

router.patch(
    "/:id/notificationPreference",
    authentication,
    updateUserNotificationPreference
);

// Onboarding routes
router.get("/onboardingDetail", authentication, getUserOnboardingDetail);

router.post("/userType", authentication, setUserType);

router.post("/demographics", authentication, setDemographics);

router.post("/interests", authentication, setInterests);

router.post("/onboardingComplete", authentication, onboardingComplete);
router.post("/change-password", authentication, changePassword);
router.get("/user-points", authentication, getUserPoints);

// POST /users/invite — Super Admin invites an unregistered user
router.post("/invite", authentication, inviteUser);

// GET /users/invited — Super Admin fetches all invited users with registration status
router.get("/invited", authentication, getInvitedUsers);


module.exports = router;
